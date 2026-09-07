import { PDFParse } from 'pdf-parse';
import fs from 'fs';

async function test() {
  const parser = new PDFParse({ data: new Uint8Array(10) }); // just to see if it initializes
  console.log("PDFParse works!");
}
test();
