// File definition
// Big thanks to tansy and mariush
// Code by Patrick Trumpis (ptru) with file structure comments inspired by mariush
// https://encode.su/threads/4010-Help-with-unknown-file-archive-starting-with-LZC-Header
class MyFileParser {
	constructor() {
		this.meta = undefined;
		this.files = undefined;
		this.dataOffset = undefined;
		this.byteArray = undefined;
	}

	parseArrayBuffer(buffer) {
		// re-initalize
		this.meta = new MyFileMeta();
		this.files = [];
		this.byteArray = new Uint8Array(buffer);
		
		this._parseFileMeta(buffer);

		// calculate dynamic zframe size with total header size minus acutal file size until zframe parsing is implemented
		const zframeSize = (this.meta.sizeCompressed + this.meta.sizeRecords + 72) - this.byteArray.length;
		
		// first file starts after file record table + 8 static bytes and 6-18 dynamic bytes (zframe bytes)
		const dataOffset = this.meta.offsetRecords + zframeSize + 8;
		if (dataOffset >= this.byteArray.length) {
			console.error('Error: Data offset exceeds total file size!', {'dataOffset':offsetStart, 'fileSize':this.byteArray.length});
		}
		
		// todo uncompress data begining at offset
		
		for (let i=0; i<this.meta.records.length; i++) {
			// read data from offsetStart to offsetEnd
			let offsetStart = dataOffset + this.meta.records[i].fileOffset;
			let offsetEnd = offsetStart + this.meta.records[i].fileSize;

			let file = new MyFileContainer(
				this.meta.records[i].fileName,
				this.byteArray.slice(offsetStart, offsetEnd)
			);

			// additional info for debuging
			file.fileSize = this.meta.records[i].fileSize;
			file.compressedSize = this.meta.records[i].compressedSize;

			this.files.push(file);
		}
	}

	_parseFileMeta(buffer) {
		try {
			// helper object allows to access on any offset in any format
			let dataView = new DataView(buffer);

			// parse signature as string
			this.meta.signature = String.fromCharCode.apply(null, this.byteArray.slice(0, 3));

			// parse meta (4 byte little endian)
			this.meta.version = dataView.getUint32(4, true);
			this.meta.fileCount = dataView.getUint32(8, true);
			this.meta.offsetRecords = dataView.getUint32(12, true);
			this.meta.unknown0x10 = dataView.getUint32(16, true);
			this.meta.unknown0x14 = dataView.getUint32(20, true);
			this.meta.sizeUncompressed = dataView.getUint32(24, true);
			this.meta.sizeCompressed = dataView.getUint32(28, true);

			// copy padding for debuging only
			this.meta.padding = buffer.slice(32, 64);

			this.meta.unknown0x40 = dataView.getUint32(64, true);
			this.meta.sizeRecords = dataView.getUint32(68, true);

			// copy record table to new buffer and extract in sub method
			this._parseFileRecords(buffer.slice(72, this.meta.sizeRecords + 72));
			
			// use header offset from this point on to address bytes
			const offset = this.meta.offsetRecords;

			// skip dynamic record table with header offset
			this.meta.unknown4bytes = dataView.getUint32(offset, true);
			this.sizeFrame = dataView.getUint32(4 + offset, true);

			// TODO
			// parse zstandard frame(s) into sub class
			// there can be multiple frames and data blocks per file
			this.magicNumber = dataView.getUint32(8 + this.meta.offsetRecords, true);
			
			// ignore for now
			this.frameHeader = undefined;
			this.blockHeader = undefined;
			this.blockContent = undefined;
			this.blockchecksum = undefined;

		} catch(e) {
			console.error(e);
		}
	}
	
	_parseFileRecords(buffer) {
		try {
			// another helper object with all records at offset 0
			let dataView = new DataView(buffer);
			
			let recordOffset = 0;

			// parse records for as long as file count or header size limit is reached
			for (let n=0; n<this.meta.fileCount && recordOffset<(this.meta.sizeRecords+17); n++) {
				let record = new MyFileMetaRecord();

				record.fileNameSize = dataView.getUint32(recordOffset, true);
				record.fileName = String.fromCharCode.apply(null, new Uint8Array(buffer).slice(4 + recordOffset, 4 + recordOffset + record.fileNameSize));
				record.compressedSize = dataView.getUint32(4 + recordOffset + record.fileNameSize, true);
				record.fileSize = dataView.getUint32(8 + recordOffset + record.fileNameSize, true);
				record.fileOffset = dataView.getUint32(12 + recordOffset + record.fileNameSize, true);
				
				this.meta.records.push(record);
				recordOffset += record.fileNameSize + 16;
			}
		} catch(e) {
			console.error(e);
		}
	}
}

// BEGIN file structure definition
class MyFileMeta {
	constructor() {
		// position 0x00 (72 bytes total)
		this.signature;			// 4 bytes - signature
		this.version;			// 4 bytes - version
		this.fileCount;			// 4 bytes - file count
		this.offsetRecords;		// 4 bytes - pointer to offset after records table
		this.unknown0x10;		// 4 bytes - 01 00 00 00
		this.unknown0x14;		// 4 bytes - 01 00 00 00
		this.sizeUncompressed;	// 4 bytes - uncompressed size of all files
		this.sizeCompressed;	// 4 bytes - compressed size of all files (current size and also equal to this.sizeFrame below)
		this.padding;			// 32 bytes - padding
		this.unknown0x40;		// 4 bytes - unknown 02 00 00 00
		this.sizeRecords;		// 4 bytes - ex E8 01 00 00 => 488 maybe size of FAT (list of records below)

		// position 0x48
		this.records = [];		// total byte size defined by this.sizeRecords, record count defined by this.fileCount

		this.unknown4bytes;		// 4 bytes - unknown - 01 00 00 00
		this.sizeFrame;			// 4 bytes - size of zsdt data/frame (everything that comes after this 4 bytes)

		// data at this position is compressed with zstd and starts at this.offsetRecords + 8 bytes;
		
		// Zstandard Frame		(https://github.com/facebook/zstd/blob/dev/doc/zstd_compression_format.md)
		this.magicNumber;		// 4 bytes - Magic Number, always 28 b5 2f fd (https://datatracker.ietf.org/doc/html/rfc8478#section-3.1.1)
		this.frameHeader;		// 2-14 bytes - Frame Header (https://datatracker.ietf.org/doc/html/rfc8478#section-3.1.1.1)
		this.blockHeader;		// 3 bytes - Block Header (https://datatracker.ietf.org/doc/html/rfc8478#section-3.1.1.2)
		this.blockContent;		// n bytes - Block Content
		this.blockchecksum;		// 0-4 bytes Content Checksum An optional 32-bit checksum, only present if Content_Checksum_Flag is set.
								// The content checksum is the result of the XXH64() hash function [XXHASH] digesting the original (decoded) data as input, and a seed of zero.
								// The low 4 bytes of the checksum are stored in little-endian format.
	}
}
class MyFileMetaRecord {
	constructor() {
		this.fileNameSize;	// 4 bytes - file name length
		this.fileName;		// n bytes - file name
		this.compressedSize;// 4 bytes - compressed file size
		this.fileSize;		// 4 bytes - file size
		this.fileOffset;	// 4 bytes - file offset
	}
}
// END file structure definition


// Helper class to hold actual file data
class MyFileContainer {
	constructor(fileName, rawData) {
		this.fileName = fileName;
		this.rawData = rawData;
		this.compressedSize;
		this.fileSize;
	}
}

function handleEvent(event) {
	// file reader event log
    eventLog.textContent += `${event.type}: ${event.loaded} bytes transferred\n`;
}

function addListeners(reader) {
	// log all file reader events (not required debug only)
    reader.addEventListener('loadstart', handleEvent);
    reader.addEventListener('load', handleEvent);
    reader.addEventListener('loadend', handleEvent);
    reader.addEventListener('progress', handleEvent);
    reader.addEventListener('error', handleEvent);
    reader.addEventListener('abort', handleEvent);
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function handleSelectedFile(e) {
    const selectedFile = fileInput.files[0];
	eventLog.textContent = '';

    if (selectedFile) {
		eventLog.textContent = 'New file selection\n';
		eventLog.textContent += `File Type: ${selectedFile.type}\n`;

		// for debuging only
        addListeners(reader);

		// read in file data as byte array
		reader.onload = function(e) {
			parser.parseArrayBuffer(reader.result);
		
			eventLog.textContent += `Found ${parser.files.length} files in archive\n`;
	
			var totalFileSize = 0;
			var totalCompressedSize = 0;
			parser.files.forEach(function (file, i) {
				let sizeInfo = formatBytes(file.rawData.length);
				eventLog.textContent += `File ${i}: ${file.fileName} with ${sizeInfo}\n`;
				
				totalFileSize += file.fileSize;
				totalCompressedSize += file.compressedSize;
			});
			
			totalFileSize = formatBytes(totalFileSize);
			totalCompressedSize = formatBytes(totalCompressedSize);
			
			eventLog.textContent += `Total file size ${totalFileSize}\n`;
			eventLog.textContent += `Total compressed size ${totalCompressedSize}\n`;
		}
		reader.readAsArrayBuffer(selectedFile);
    }
}

const fileInput = document.querySelector('input[type="file"]');
const data = document.querySelector('.file-data');
const eventLog = document.querySelector('.event-log-contents');

const reader = new FileReader();
const parser = new MyFileParser();

// listen to file input changes
fileInput.addEventListener('change', handleSelectedFile);
