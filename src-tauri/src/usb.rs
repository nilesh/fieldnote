//! Jensen USB protocol implementation for HiDock devices.
//!
//! Wire format (both directions):
//!   [0x12, 0x34]          2 bytes  magic
//!   [cmd_hi, cmd_lo]      2 bytes  command/message ID  (big-endian u16)
//!   [s3,s2,s1,s0]         4 bytes  sequence number     (big-endian u32)
//!   [l3,l2,l1,l0]         4 bytes  where high byte = padding, low 3 = body len
//!   [...body]             N bytes  payload
//!   [...padding]          P bytes  padding (P = high byte above)
//!
//! USB setup:
//!   - claimInterface(0)
//!   - Bulk OUT endpoint address: 0x01
//!   - Bulk IN  endpoint address: 0x82
//!
//! Why rusb (libusb) instead of nusb:
//!   On macOS, nusb calls IOUSBDeviceOpen() which requires exclusive access.
//!   libusb calls IOUSBDeviceOpenSeize() which forcefully takes the device
//!   from accessoryd (the MFi authenticator daemon that holds the P1 on
//!   plug-in). This is also how Chrome's WebUSB opens the device.

use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

/// Query ioreg to find which process holds the USB interface exclusively.
/// Returns e.g. Some("Arc") if another app has the device claimed.
#[cfg(target_os = "macos")]
fn find_usb_exclusive_owner(vid: u16, pid: u16) -> Option<String> {
    let output = std::process::Command::new("ioreg")
        .args(["-r", "-c", "IOUSBHostInterface", "-l"])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);

    // Find interface blocks belonging to our device (by idVendor/idProduct)
    let vid_needle = format!("\"idVendor\" = {}", vid);
    let pid_needle = format!("\"idProduct\" = {}", pid);
    let exe = std::env::current_exe().ok()?;
    let self_name = exe.file_name()?.to_str()?;

    for block in text.split("+-o ") {
        if !block.contains(&vid_needle) || !block.contains(&pid_needle) {
            continue;
        }
        // Look for UsbExclusiveOwner
        for line in block.lines() {
            if let Some(rest) = line.strip_suffix("\"") {
                if let Some(idx) = rest.find("\"UsbExclusiveOwner\" = \"") {
                    let val = &rest[idx + "\"UsbExclusiveOwner\" = \"".len()..];
                    // Format: "pid NNNNN, ProcessName"
                    if let Some(comma_pos) = val.find(", ") {
                        let proc_name = &val[comma_pos + 2..];
                        if proc_name != self_name && proc_name != "accessoryd" {
                            return Some(proc_name.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

#[cfg(not(target_os = "macos"))]
fn find_usb_exclusive_owner(_vid: u16, _pid: u16) -> Option<String> {
    None
}

// ─── Endpoint addresses ───────────────────────────────────────────────────────
const EP_OUT: u8 = 0x01;
const EP_IN:  u8 = 0x82;

// ─── Command IDs ──────────────────────────────────────────────────────────────
const CMD_QUERY_DEVICE_INFO: u16 = 1;
const CMD_QUERY_FILE_COUNT:  u16 = 6;
const CMD_QUERY_FILE_LIST:   u16 = 4;
const CMD_TRANSFER_FILE:     u16 = 5;
const CMD_DELETE_FILE:       u16 = 7;
const CMD_GET_FILE_BLOCK:    u16 = 13;

// ─── Known VIDs / PIDs ────────────────────────────────────────────────────────
const VID_HIDOCK:  u16 = 0x10D6;
const VID_HIDOCK2: u16 = 0x388F;

fn is_hidock(vid: u16, pid: u16) -> bool {
    if vid == VID_HIDOCK {
        matches!(pid, 0xB00C | 0xB00D | 0xB00E | 0xB00F)
    } else if vid == VID_HIDOCK2 {
        matches!(pid, 0x0100 | 0x0101 | 0x0102 | 0x0103 | 0x0240)
    } else {
        false
    }
}

fn pid_to_model(pid: u16) -> &'static str {
    match pid {
        0xB00C | 0x0100 | 0x0102 => "hidock-h1",
        0xB00D | 0x0101 | 0x0103 => "hidock-h1e",
        0xB00E | 0x0240           => "hidock-p1",
        0xB00F | 0x0241           => "hidock-p1:mini",
        _                         => "unknown",
    }
}

// ─── Public types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsbDeviceInfo {
    pub sn: String,
    pub model: String,
    pub version_code: String,
    pub version_number: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub size: u32,
    pub signature: String,
}

// ─── Packet encoding ──────────────────────────────────────────────────────────

fn encode_packet(cmd: u16, seq: u32, body: &[u8]) -> Vec<u8> {
    let mut pkt = Vec::with_capacity(12 + body.len());
    pkt.push(0x12);
    pkt.push(0x34);
    pkt.push((cmd >> 8) as u8);
    pkt.push(cmd as u8);
    pkt.push((seq >> 24) as u8);
    pkt.push((seq >> 16) as u8);
    pkt.push((seq >> 8) as u8);
    pkt.push(seq as u8);
    let len = body.len() as u32;
    pkt.push((len >> 24) as u8);
    pkt.push((len >> 16) as u8);
    pkt.push((len >> 8) as u8);
    pkt.push(len as u8);
    pkt.extend_from_slice(body);
    pkt
}

// ─── Packet decoding ──────────────────────────────────────────────────────────

struct Packet {
    id: u16,
    body: Vec<u8>,
}

fn try_parse(buf: &[u8]) -> Option<(Packet, usize)> {
    if buf.len() < 12 {
        return None;
    }
    if buf[0] != 0x12 || buf[1] != 0x34 {
        return None;
    }
    let id = ((buf[2] as u16) << 8) | buf[3] as u16;
    let raw = ((buf[8]  as u32) << 24)
            | ((buf[9]  as u32) << 16)
            | ((buf[10] as u32) << 8)
            |  (buf[11] as u32);
    let padding  = ((raw >> 24) & 0xFF) as usize;
    let body_len = (raw & 0x00FF_FFFF) as usize;
    let total    = 12 + body_len + padding;
    if buf.len() < total {
        return None;
    }
    Some((Packet { id, body: buf[12..12 + body_len].to_vec() }, total))
}

// ─── USB session ──────────────────────────────────────────────────────────────

pub struct UsbSession {
    handle: rusb::DeviceHandle<rusb::GlobalContext>,
    seq:    u32,
    rx_buf: Vec<u8>,
    pub model: String,
}

impl UsbSession {
    /// Find and open a HiDock device.
    ///
    /// Uses a patched libusb that calls IOUSBInterfaceOpenSeize on macOS,
    /// which forcefully takes the interface from accessoryd (MFi daemon).
    pub fn open() -> Result<Self, String> {
        let devices = rusb::devices().map_err(|e| e.to_string())?;

        for device in devices.iter() {
            let desc = match device.device_descriptor() {
                Ok(d)  => d,
                Err(_) => continue,
            };
            let vid = desc.vendor_id();
            let pid = desc.product_id();
            if !is_hidock(vid, pid) {
                continue;
            }

            let model = pid_to_model(pid).to_string();

            let handle = device
                .open()
                .map_err(|e| format!("USB_OPEN_FAILED: device.open() returned: {e}"))?;

            // Enumerate interfaces to find the one with bulk IN+OUT endpoints.
            let config_desc = device.active_config_descriptor()
                .map_err(|e| format!("USB_CONFIG_FAILED: {e}"))?;

            let mut data_iface: Option<u8> = None;
            let mut iface_debug = Vec::new();

            for iface in config_desc.interfaces() {
                for idesc in iface.descriptors() {
                    let num = idesc.interface_number();
                    let eps: Vec<String> = idesc.endpoint_descriptors()
                        .map(|ep| format!("0x{:02x}({:?})", ep.address(), ep.transfer_type()))
                        .collect();
                    iface_debug.push(format!(
                        "iface{}:class={},sub={},proto={},eps=[{}]",
                        num, idesc.class_code(), idesc.sub_class_code(),
                        idesc.protocol_code(), eps.join(",")
                    ));

                    let has_bulk_in = idesc.endpoint_descriptors()
                        .any(|ep| ep.address() == EP_IN && matches!(ep.transfer_type(), rusb::TransferType::Bulk));
                    let has_bulk_out = idesc.endpoint_descriptors()
                        .any(|ep| ep.address() == EP_OUT && matches!(ep.transfer_type(), rusb::TransferType::Bulk));

                    if has_bulk_in && has_bulk_out && data_iface.is_none() {
                        data_iface = Some(num);
                    }
                }
            }

            let target_iface = data_iface.unwrap_or(0);

            // On Linux, detach any kernel driver first
            #[cfg(not(target_os = "macos"))]
            let _ = handle.detach_kernel_driver(target_iface);

            // On macOS, our patched libusb uses USBInterfaceOpenSeize
            // which forcefully takes the interface from accessoryd.
            handle.claim_interface(target_iface).map_err(|e| {
                // Check ioreg for the process holding the interface
                let owner = find_usb_exclusive_owner(vid, pid);
                let hint = if let Some(ref proc) = owner {
                    format!(" The USB interface is held by \"{proc}\". Close that app and retry.")
                } else {
                    String::new()
                };
                format!(
                    "USB_CLAIM_FAILED: claim_interface({target_iface}) returned: {e}.{hint} \
                     Device interfaces: [{}]",
                    iface_debug.join("; ")
                )
            })?;

            let _ = handle.set_alternate_setting(target_iface, 0);

            return Ok(Self { handle, seq: 0, rx_buf: Vec::new(), model });
        }

        Err("HiDock device not found. Make sure it is connected via USB.".to_string())
    }

    fn next_seq(&mut self) -> u32 {
        let s = self.seq;
        self.seq = self.seq.wrapping_add(1);
        s
    }

    fn write_packet(&mut self, cmd: u16, seq: u32, body: &[u8]) -> Result<(), String> {
        let pkt = encode_packet(cmd, seq, body);
        self.handle
            .write_bulk(EP_OUT, &pkt, Duration::from_secs(10))
            .map_err(|e| format!("USB write error: {e}"))?;
        Ok(())
    }

    /// Single bulk IN read appending to rx_buf. Returns true if bytes arrived.
    fn read_chunk(&mut self, timeout_ms: u64) -> Result<bool, String> {
        let mut tmp = vec![0u8; 65536];
        match self.handle.read_bulk(EP_IN, &mut tmp, Duration::from_millis(timeout_ms)) {
            Ok(n) if n > 0 => {
                self.rx_buf.extend_from_slice(&tmp[..n]);
                Ok(true)
            }
            Ok(_)                     => Ok(false),
            Err(rusb::Error::Timeout) => Ok(false),
            Err(e)                    => Err(format!("USB read error: {e}")),
        }
    }

    fn recv_packet(&mut self, timeout_ms: u64) -> Result<Packet, String> {
        let deadline = Instant::now() + Duration::from_millis(timeout_ms);
        loop {
            if let Some((pkt, consumed)) = try_parse(&self.rx_buf) {
                self.rx_buf.drain(..consumed);
                return Ok(pkt);
            }
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                return Err("USB receive timeout".to_string());
            }
            self.read_chunk(left.as_millis().min(200) as u64)?;
        }
    }

    fn transact(&mut self, cmd: u16, body: &[u8], timeout_ms: u64) -> Result<Packet, String> {
        let seq = self.next_seq();
        self.write_packet(cmd, seq, body)?;
        self.recv_packet(timeout_ms)
    }

    // ── Protocol commands ────────────────────────────────────────────────────

    pub fn get_device_info(&mut self) -> Result<UsbDeviceInfo, String> {
        let pkt = self.transact(CMD_QUERY_DEVICE_INFO, &[], 5_000)?;
        eprintln!("[USB DEBUG] device_info: cmd={}, body_len={}, hex={:02x?}",
            pkt.id, pkt.body.len(), &pkt.body[..pkt.body.len().min(40)]);
        if pkt.body.len() < 4 {
            return Err(format!("device info response too short: {} bytes", pkt.body.len()));
        }
        let version_number = ((pkt.body[0] as u32) << 24)
            | ((pkt.body[1] as u32) << 16)
            | ((pkt.body[2] as u32) << 8)
            |  (pkt.body[3] as u32);
        let version_code = format!("{}.{}.{}", pkt.body[1], pkt.body[2], pkt.body[3]);
        let sn = if pkt.body.len() > 4 {
            String::from_utf8_lossy(&pkt.body[4..])
                .trim_end_matches('\0')
                .to_string()
        } else {
            String::new()
        };
        eprintln!("[USB DEBUG] device_info parsed: sn={:?}, version={}", sn, version_code);
        Ok(UsbDeviceInfo { sn, model: self.model.clone(), version_code, version_number })
    }

    pub fn list_files(&mut self) -> Result<Vec<FileEntry>, String> {
        let count_pkt = self.transact(CMD_QUERY_FILE_COUNT, &[], 5_000)?;
        eprintln!("[USB DEBUG] file_count: cmd={}, body_len={}, hex={:02x?}",
            count_pkt.id, count_pkt.body.len(), &count_pkt.body[..count_pkt.body.len().min(20)]);
        let max_count = if count_pkt.body.len() >= 4 {
            ((count_pkt.body[0] as usize) << 24)
                | ((count_pkt.body[1] as usize) << 16)
                | ((count_pkt.body[2] as usize) << 8)
                |  (count_pkt.body[3] as usize)
        } else {
            usize::MAX
        };
        eprintln!("[USB DEBUG] file_count parsed: max_count={}", max_count);

        if max_count == 0 {
            return Ok(Vec::new());
        }

        let seq = self.next_seq();
        self.write_packet(CMD_QUERY_FILE_LIST, seq, &[])?;
        let mut raw: Vec<u8> = Vec::new();
        let mut got_data = false;
        loop {
            // Use a short timeout after receiving data — the device may not
            // send an empty terminator packet after the last chunk.
            let timeout = if got_data { 1_000 } else { 10_000 };
            match self.recv_packet(timeout) {
                Ok(pkt) => {
                    eprintln!("[USB DEBUG] file_list pkt: cmd={}, body_len={}", pkt.id, pkt.body.len());
                    if pkt.id != CMD_QUERY_FILE_LIST { continue; }
                    if pkt.body.is_empty() { break; }
                    raw.extend_from_slice(&pkt.body);
                    got_data = true;
                }
                Err(_) if got_data => {
                    eprintln!("[USB DEBUG] file_list: no terminator, using {} bytes received", raw.len());
                    break;
                }
                Err(e) => return Err(e),
            }
        }
        eprintln!("[USB DEBUG] file_list total raw bytes: {}", raw.len());

        parse_file_list(&raw, max_count)
    }

    pub fn get_file(&mut self, name: &str, length: u32) -> Result<Vec<u8>, String> {
        eprintln!("[USB DEBUG] get_file: name={:?} length={}", name, length);

        // Step 1: Initiate transfer with TRANSFER_FILE (cmd 5)
        let mut req_body = Vec::with_capacity(4 + name.len());
        req_body.extend_from_slice(&length.to_be_bytes());
        req_body.extend_from_slice(name.as_bytes());
        let ack = self.transact(CMD_TRANSFER_FILE, &req_body, 10_000)?;
        eprintln!(
            "[USB DEBUG] get_file ack: cmd={}, body_len={}",
            ack.id, ack.body.len()
        );

        // Step 2: Fetch data blocks with GET_FILE_BLOCK (cmd 13)
        let mut data: Vec<u8> = Vec::with_capacity(length as usize);
        let mut block_num: u32 = 0;
        loop {
            let offset = data.len() as u32;
            let block_req = offset.to_be_bytes();
            let pkt = self.transact(CMD_GET_FILE_BLOCK, &block_req, 30_000)?;

            if block_num < 3 || block_num % 100 == 0 {
                eprintln!(
                    "[USB DEBUG] get_file block#{}: cmd={}, body_len={}, total={}/{}",
                    block_num, pkt.id, pkt.body.len(), data.len(), length
                );
            }

            if pkt.body.is_empty() { break; }
            data.extend_from_slice(&pkt.body);
            block_num += 1;
            if data.len() >= length as usize { break; }
        }
        eprintln!(
            "[USB DEBUG] get_file done: {} blocks, {} bytes (expected {})",
            block_num, data.len(), length
        );
        Ok(data)
    }

    pub fn delete_file(&mut self, name: &str) -> Result<String, String> {
        self.transact(CMD_DELETE_FILE, name.as_bytes(), 10_000)?;
        Ok("ok".to_string())
    }
}

// ─── File list parser ─────────────────────────────────────────────────────────

fn parse_file_list(data: &[u8], max_count: usize) -> Result<Vec<FileEntry>, String> {
    let mut pos = 0;

    // Optional 0xFF FF header + 4-byte total count
    if data.len() >= 6 && data[0] == 0xFF && data[1] == 0xFF {
        pos += 6;
    }

    let mut files = Vec::new();
    while pos < data.len() && files.len() < max_count {
        if pos + 4 > data.len() { break; }
        let _version = data[pos];
        let name_len = ((data[pos + 1] as usize) << 16)
                     | ((data[pos + 2] as usize) << 8)
                     |  (data[pos + 3] as usize);
        pos += 4;

        if name_len == 0 || pos + name_len > data.len() { break; }
        let name = String::from_utf8_lossy(&data[pos..pos + name_len]).to_string();
        pos += name_len;

        if pos + 4 > data.len() { break; }
        let size = ((data[pos]     as u32) << 24)
                 | ((data[pos + 1] as u32) << 16)
                 | ((data[pos + 2] as u32) << 8)
                 |  (data[pos + 3] as u32);
        pos += 4;

        pos += 6; // 6 unknown bytes
        if pos > data.len() { break; }

        if pos + 16 > data.len() { break; }
        let signature = data[pos..pos + 16]
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<String>();
        pos += 16;

        // Strip trailing null bytes from device filenames
        let name = name.trim_end_matches('\0').to_string();

        if files.len() < 3 {
            eprintln!("[USB DEBUG] file[{}]: name={:?} size={} sig={}", files.len(), name, size, signature);
        }
        files.push(FileEntry { name, size, signature });
    }

    Ok(files)
}
