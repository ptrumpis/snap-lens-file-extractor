# Snap Lens File Extractor, Parser, Unpacker and Zip Converter
Web Browser based JavaScript Online File Extractor, Parser, Unpacker and Zip Converter for the Snap Camera / Snapchat Lens File Format (lens.lns / *.lns)


## Introduction
All details about the Snap Lens file format can be found here
```
https://github.com/ptrumpis/snap-lens-file-format/blob/main/README.md
```

## Usage
Visit the Github page of this repo

https://ptrumpis.github.io/snap-lens-file-extractor/


- Upload a Lens file and have it automatically converted to a zip archive for download
- Its using WebAssembly to decompress the file, it should work in modern browsers


## Current State
This is currently a port of my CodePen.io script located at
```
https://codepen.io/ptrumpis/pen/jOpQREE?editors=0010
```
It served as analyzing and debugging tool during the reverse engineering process of the file format.

Right now it serves more as proof-of-concept. It is fully functional without known bugs.


## Goals
This repo will slowly convert into a functional JS library which you can import in your own project.
