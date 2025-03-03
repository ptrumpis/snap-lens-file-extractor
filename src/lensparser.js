class LensFileParser {
    constructor() {
        this.meta = undefined;
        this.files = undefined;
        this.byteArray = undefined;
    }

    hasFiles() {
        return (this.files.length > 0);
    }

    parseArrayBuffer(buffer, zstd) {
        // re-initalize
        this.meta = new LensFileMeta();
        this.files = [];
        this.byteArray = new Uint8Array(buffer);

        this._parseFileMeta(buffer);

        // decompress zstd block and return new Uint8Array
        try {
            let compressedData = this.byteArray.slice(this.meta.offsetRecords + 8);
            let uncompressedData = zstd.decompress(compressedData);

            for (let i = 0; i < this.meta.records.length; i++) {
                // read data from offsetStart to offsetEnd
                let offsetStart = this.meta.records[i].fileOffset;
                let offsetEnd = offsetStart + this.meta.records[i].fileSize;

                let file = new LensFileContainer(
                    this.meta.records[i].fileName,
                    uncompressedData.slice(offsetStart, offsetEnd)
                );

                // additional info for debuging
                file.fileSize = this.meta.records[i].fileSize;
                file.compressedSize = this.meta.records[i].compressedSize;

                this.files.push(file);
            }
        } catch (e) {
            console.error(e);
        }
    }

    _parseFileMeta(buffer) {
        try {
            // helper object allows to access on any offset in any format
            let dataView = new DataView(buffer);

            // parse signature as string
            this.meta.signature = String.fromCharCode.apply(null, new Uint8Array(buffer.slice(0, 3)));

            // parse meta (4 byte little endian)
            this.meta.version = dataView.getUint32(4, true);
            this.meta.fileCount = dataView.getUint32(8, true);
            this.meta.offsetRecords = dataView.getUint32(12, true);
            this.meta.unknown0x10 = dataView.getUint32(16, true);
            this.meta.unknown0x14 = dataView.getUint32(20, true);
            this.meta.sizeUncompressed = dataView.getUint32(24, true);
            this.meta.sizeCompressed = dataView.getUint32(28, true);

            // 32 byte padding here

            this.meta.unknown0x40 = dataView.getUint32(64, true);
            this.meta.sizeRecords = dataView.getUint32(68, true);

            // copy record table to new buffer and extract in sub method
            this._parseFileRecords(buffer.slice(72, this.meta.sizeRecords + 72));

            // use header offset from this point on to address bytes
            const offset = this.meta.offsetRecords;

            // skip dynamic record table with header offset
            this.meta.unknown4bytes = dataView.getUint32(offset, true);
            this.meta.sizeZstd = dataView.getUint32(4 + offset, true);

            // copy first 4 bytes of zstd data (magic number)
            this.meta.magicNumber = dataView.getUint32(8 + this.meta.offsetRecords, true);

        } catch (e) {
            console.error(e);
        }
    }

    _parseFileRecords(buffer) {
        try {
            // another helper object with all records at offset 0
            let dataView = new DataView(buffer);
            let recordOffset = 0;

            // parse records for as long as file count or header size limit is reached
            // valid file records should have at least 16 static bytes and 1-n dynamic bytes
            for (let n = 0; n < this.meta.fileCount && recordOffset < (this.meta.sizeRecords + 17); n++) {
                let record = new LensFileMetaRecord();

                record.fileNameSize = dataView.getUint32(recordOffset, true);
                record.fileName = String.fromCharCode.apply(null, new Uint8Array(buffer).slice(4 + recordOffset, 4 + recordOffset + record.fileNameSize));
                record.compressedSize = dataView.getUint32(4 + recordOffset + record.fileNameSize, true);
                record.fileSize = dataView.getUint32(8 + recordOffset + record.fileNameSize, true);
                record.fileOffset = dataView.getUint32(12 + recordOffset + record.fileNameSize, true);

                this.meta.records.push(record);
                recordOffset += record.fileNameSize + 16;
            }
        } catch (e) {
            console.error(e);
        }
    }
}

// BEGIN file structure definition
class LensFileMeta {
    constructor() {
        // position 0x00 (72 bytes total)
        this.signature;          // 4 bytes - signature
        this.version;            // 4 bytes - version
        this.fileCount;          // 4 bytes - file count
        this.offsetRecords;      // 4 bytes - pointer to offset after records table
        this.unknown0x10;        // 4 bytes - 01 00 00 00
        this.unknown0x14;        // 4 bytes - 01 00 00 00
        this.sizeUncompressed;   // 4 bytes - uncompressed size of all files
        this.sizeCompressed;     // 4 bytes - compressed size of all files (current size of zst data block and also equal to this.sizeZstd)
        this.padding;            // 32 bytes - padding
        this.unknown0x40;        // 4 bytes - unknown 02 00 00 00
        this.sizeRecords;        // 4 bytes - size of FAT (list of records below)

        // position 0x48
        this.records = [];       // total byte size defined by this.sizeRecords, record count defined by this.fileCount

        this.unknown4bytes;      // 4 bytes - unknown - 01 00 00 00
        this.sizeZstd;           // 4 bytes - size of zsdt data/frame (everything that comes after this 4 bytes)

        // data at this position is compressed with zstd and starts at this.offsetRecords + 8 bytes;

        // Zstandard            (https://github.com/facebook/zstd/blob/dev/doc/zstd_compression_format.md)
        this.magicNumber;        // first 4 bytes - Magic Number, always 28 b5 2f fd (https://datatracker.ietf.org/doc/html/rfc8478#section-3.1.1)
    }
}
class LensFileMetaRecord {
    constructor() {
        this.fileNameSize;   // 4 bytes - file name length
        this.fileName;       // n bytes - file name
        this.compressedSize; // 4 bytes - file size compressed?
        this.fileSize;       // 4 bytes - file size uncompressed
        this.fileOffset;     // 4 bytes - file offset
    }
}
// END file structure definition


// Helper class to hold actual file data
class LensFileContainer {
    constructor(fileName, rawData) {
        this.fileName = fileName;
        this.rawData = rawData;
    }
}

export default LensFileParser;

if (typeof module !== "undefined" && module.exports) {
    module.exports = LensFileParser;
}
