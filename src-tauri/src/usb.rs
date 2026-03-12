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
//!   - selectConfiguration(1) / claimInterface(0) / selectAlternateInterface(0,0)
//!   - Bulk OUT endpoint address: 0x01
//!   - Bulk IN  endpoint address: 0x82

use serde::{Deserialize, Serialize};
use nusb::transfer::RequestBuffer;

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
const VID_HIDOCK:  u16 = 0x10D6; // 4310
const VID_HIDOCK2: u16 = 0x388F; // 14471

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
        0xB00E | 0x2040           => "hidock-p1",
        0xB00F | 0x2041           => "hidock-p1:mini",
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

/// Try to parse the first complete packet from `buf`.
/// Returns `Some((packet, bytes_consumed))` or `None` if incomplete.
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
    Some((
        Packet { id, body: buf[12..12 + body_len].to_vec() },
        total,
    ))
}

// ─── USB session ─────────────────────────────────────────────────────────────

pub struct UsbSession {
    iface: nusb::Interface,
    seq:   u32,
    rx_buf: Vec<u8>,
    pub model: String,
}

impl UsbSession {
    /// Find and open a HiDock device. Returns Err if none found.
    ///
    /// Retries up to 5 times with a short delay to handle the window where
    /// macOS `accessoryd` briefly holds exclusive access for MFi authentication.
    pub async fn open() -> Result<Self, String> {
        const MAX_ATTEMPTS: u32 = 5;
        const RETRY_DELAY_MS: u64 = 400;

        let mut last_err = String::new();
        for attempt in 0..MAX_ATTEMPTS {
            match Self::try_open() {
                Ok(session) => return Ok(session),
                Err(e) if e.starts_with("EXCLUSIVE_ACCESS") => {
                    last_err = e;
                    if attempt + 1 < MAX_ATTEMPTS {
                        tokio::time::sleep(std::time::Duration::from_millis(RETRY_DELAY_MS)).await;
                    }
                }
                Err(e) => return Err(e),
            }
        }
        Err(last_err)
    }

    /// Single attempt to find and open the device.
    fn try_open() -> Result<Self, String> {
        let dev_info = nusb::list_devices()
            .map_err(|e| e.to_string())?
            .find(|d| is_hidock(d.vendor_id(), d.product_id()))
            .ok_or_else(|| "HiDock device not found. Make sure it is connected via USB.".to_string())?;

        let model = pid_to_model(dev_info.product_id()).to_string();
        let device = dev_info.open()
            .map_err(|e| format!("EXCLUSIVE_ACCESS: Cannot open USB device ({e})."))?;
        let iface  = device.claim_interface(0)
            .map_err(|e| format!("EXCLUSIVE_ACCESS: Cannot claim USB interface ({e})."))?;

        Ok(Self { iface, seq: 0, rx_buf: Vec::new(), model })
    }

    fn next_seq(&mut self) -> u32 {
        let s = self.seq;
        self.seq = self.seq.wrapping_add(1);
        s
    }

    async fn write(&mut self, cmd: u16, seq: u32, body: &[u8]) -> Result<(), String> {
        let pkt = encode_packet(cmd, seq, body);
        let completion = self.iface.bulk_out(EP_OUT, pkt).await;
        completion.status.map_err(|e| format!("USB write error: {e:?}"))?;
        Ok(())
    }

    /// Read raw bytes from the device, appending into rx_buf.
    async fn fill_buf(&mut self) -> Result<(), String> {
        let completion = self.iface
            .bulk_in(EP_IN, RequestBuffer::new(512 * 1024))
            .await;
        let _n = completion.status.map_err(|e| format!("USB read error: {e:?}"))?;
        self.rx_buf.extend_from_slice(&completion.data);
        Ok(())
    }

    /// Read until we have one complete packet, with timeout.
    async fn recv_packet(&mut self, timeout_ms: u64) -> Result<Packet, String> {
        let deadline = tokio::time::Instant::now()
            + std::time::Duration::from_millis(timeout_ms);

        loop {
            if let Some((pkt, consumed)) = try_parse(&self.rx_buf) {
                self.rx_buf.drain(..consumed);
                return Ok(pkt);
            }
            if tokio::time::Instant::now() >= deadline {
                return Err(format!("USB read timeout after {}ms", timeout_ms));
            }
            self.fill_buf().await?;
        }
    }

    /// Send a command and receive a single response packet.
    async fn transact(&mut self, cmd: u16, body: &[u8], timeout_ms: u64) -> Result<Packet, String> {
        let seq = self.next_seq();
        self.write(cmd, seq, body).await?;
        self.recv_packet(timeout_ms).await
    }

    // ─── Public protocol methods ─────────────────────────────────────────────

    /// Query device info. Returns serial number, version, and model.
    pub async fn get_device_info(&mut self) -> Result<UsbDeviceInfo, String> {
        let pkt = self.transact(CMD_QUERY_DEVICE_INFO, &[], 5_000).await?;
        let body = &pkt.body;
        if body.len() < 20 {
            return Err(format!("Device info response too short: {} bytes", body.len()));
        }

        // Bytes 0-3: version (big-endian u32). Skip byte 0 for display.
        let version_number: u32 = ((body[0] as u32) << 24)
            | ((body[1] as u32) << 16)
            | ((body[2] as u32) << 8)
            |  body[3] as u32;
        let version_code = format!("{}.{}.{}", body[1], body[2], body[3]);

        // Bytes 4-19: serial number (ASCII, skip null bytes)
        let sn: String = body[4..20]
            .iter()
            .filter(|&&b| b > 0)
            .map(|&b| b as char)
            .collect();

        Ok(UsbDeviceInfo {
            sn,
            model: self.model.clone(),
            version_code,
            version_number,
        })
    }

    /// List files on the device.
    pub async fn list_files(&mut self) -> Result<Vec<FileEntry>, String> {
        // 1. Get file count first (required for older firmware, harmless for new).
        let count_pkt = self.transact(CMD_QUERY_FILE_COUNT, &[], 5_000).await?;
        let count = if count_pkt.body.len() >= 4 {
            ((count_pkt.body[0] as u32) << 24)
                | ((count_pkt.body[1] as u32) << 16)
                | ((count_pkt.body[2] as u32) << 8)
                |  count_pkt.body[3] as u32
        } else {
            0
        };
        if count == 0 {
            return Ok(Vec::new());
        }

        // 2. Send QUERY_FILE_LIST and accumulate multi-packet response.
        let seq = self.next_seq();
        self.write(CMD_QUERY_FILE_LIST, seq, &[]).await?;

        let mut raw: Vec<u8> = Vec::new();
        loop {
            let pkt = self.recv_packet(15_000).await?;
            if pkt.id == CMD_QUERY_FILE_LIST {
                if pkt.body.is_empty() {
                    break; // device signals end of list
                }
                raw.extend_from_slice(&pkt.body);
            }
        }

        parse_file_list(&raw, count as usize)
    }

    /// Download a file by name. `length` is the file's byte count from the file list.
    pub async fn get_file(&mut self, name: &str, length: u32) -> Result<Vec<u8>, String> {
        let body: Vec<u8> = name.bytes().collect();
        let seq = self.next_seq();
        self.write(CMD_TRANSFER_FILE, seq, &body).await?;

        let mut data: Vec<u8> = Vec::with_capacity(length as usize);
        while (data.len() as u32) < length {
            let pkt = self.recv_packet(60_000).await?;
            if pkt.body.is_empty() {
                break;
            }
            data.extend_from_slice(&pkt.body);
        }

        Ok(data)
    }

    /// Delete a file by name.
    pub async fn delete_file(&mut self, name: &str) -> Result<String, String> {
        let body: Vec<u8> = name.bytes().collect();
        let pkt = self.transact(CMD_DELETE_FILE, &body, 5_000).await?;
        let result = match pkt.body.first().copied().unwrap_or(2) {
            0 => "success",
            1 => "not-found",
            _ => "failed",
        };
        Ok(result.to_string())
    }
}

// ─── File list parser ─────────────────────────────────────────────────────────

fn parse_file_list(data: &[u8], max_count: usize) -> Result<Vec<FileEntry>, String> {
    let mut entries: Vec<FileEntry> = Vec::new();
    let mut i = 0usize;

    // Optional header: first two bytes 0xFF 0xFF, then 4-byte total count.
    if data.len() >= 6 && data[0] == 0xFF && data[1] == 0xFF {
        i = 6;
    }

    while i < data.len() && entries.len() < max_count {
        if i + 4 > data.len() {
            break;
        }

        // 1 byte: format version (audio encoding type)
        let _version = data[i];
        i += 1;

        // 3 bytes: filename length
        if i + 3 > data.len() { break; }
        let name_len = ((data[i] as usize) << 16)
            | ((data[i + 1] as usize) << 8)
            |  data[i + 2] as usize;
        i += 3;

        // N bytes: filename (skip null bytes)
        if i + name_len > data.len() { break; }
        let name: String = data[i..i + name_len]
            .iter()
            .filter(|&&b| b > 0)
            .map(|&b| b as char)
            .collect();
        i += name_len;

        // 4 bytes: file size
        if i + 4 + 6 + 16 > data.len() { break; }
        let size = ((data[i] as u32) << 24)
            | ((data[i + 1] as u32) << 16)
            | ((data[i + 2] as u32) << 8)
            |  data[i + 3] as u32;
        i += 4;

        // 6 bytes: unknown — skip
        i += 6;

        // 16 bytes: MD5 signature
        let sig: String = data[i..i + 16]
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect();
        i += 16;

        if !name.is_empty() {
            entries.push(FileEntry { name, size, signature: sig });
        }
    }

    Ok(entries)
}
