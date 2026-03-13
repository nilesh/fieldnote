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

// ─── Endpoint addresses ───────────────────────────────────────────────────────
const EP_OUT: u8 = 0x01;
const EP_IN:  u8 = 0x82;

// ─── Command IDs ──────────────────────────────────────────────────────────────
const CMD_QUERY_DEVICE_INFO: u16 = 1;
const CMD_QUERY_FILE_COUNT:  u16 = 6;
const CMD_QUERY_FILE_LIST:   u16 = 4;
const CMD_TRANSFER_FILE:     u16 = 5;
const CMD_DELETE_FILE:       u16 = 7;

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
    /// Uses libusb's IOUSBDeviceOpenSeize on macOS, which forcefully takes
    /// the device from accessoryd. No retry needed — the seize is immediate.
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
                .map_err(|e| format!("EXCLUSIVE_ACCESS: Cannot open USB device ({e})."))?;

            // detach_kernel_driver is a no-op on macOS (returns Unsupported);
            // on Linux it detaches the usbfs driver if attached.
            let _ = handle.detach_kernel_driver(0);

            handle
                .claim_interface(0)
                .map_err(|e| format!("EXCLUSIVE_ACCESS: Cannot claim USB interface ({e})."))?;

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
        if pkt.body.len() < 20 {
            return Err(format!("device info response too short: {} bytes", pkt.body.len()));
        }
        let version_number = ((pkt.body[0] as u32) << 24)
            | ((pkt.body[1] as u32) << 16)
            | ((pkt.body[2] as u32) << 8)
            |  (pkt.body[3] as u32);
        let version_code = format!("{}.{}.{}", pkt.body[1], pkt.body[2], pkt.body[3]);
        let sn = String::from_utf8_lossy(&pkt.body[4..20])
            .trim_end_matches('\0')
            .to_string();
        Ok(UsbDeviceInfo { sn, model: self.model.clone(), version_code, version_number })
    }

    pub fn list_files(&mut self) -> Result<Vec<FileEntry>, String> {
        let count_pkt = self.transact(CMD_QUERY_FILE_COUNT, &[], 5_000)?;
        let max_count = if count_pkt.body.len() >= 4 {
            ((count_pkt.body[0] as usize) << 24)
                | ((count_pkt.body[1] as usize) << 16)
                | ((count_pkt.body[2] as usize) << 8)
                |  (count_pkt.body[3] as usize)
        } else {
            usize::MAX
        };

        let seq = self.next_seq();
        self.write_packet(CMD_QUERY_FILE_LIST, seq, &[])?;
        let mut raw: Vec<u8> = Vec::new();
        loop {
            let pkt = self.recv_packet(10_000)?;
            if pkt.id != CMD_QUERY_FILE_LIST { continue; }
            if pkt.body.is_empty() { break; }
            raw.extend_from_slice(&pkt.body);
        }

        parse_file_list(&raw, max_count)
    }

    pub fn get_file(&mut self, name: &str, length: u32) -> Result<Vec<u8>, String> {
        let mut body = Vec::with_capacity(4 + name.len());
        body.extend_from_slice(&length.to_be_bytes());
        body.extend_from_slice(name.as_bytes());

        let _ack = self.transact(CMD_TRANSFER_FILE, &body, 10_000)?;

        let mut data: Vec<u8> = Vec::with_capacity(length as usize);
        loop {
            let pkt = self.recv_packet(30_000)?;
            if pkt.id != CMD_TRANSFER_FILE { continue; }
            if pkt.body.is_empty() { break; }
            data.extend_from_slice(&pkt.body);
            if data.len() >= length as usize { break; }
        }
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

        files.push(FileEntry { name, size, signature });
    }

    Ok(files)
}
