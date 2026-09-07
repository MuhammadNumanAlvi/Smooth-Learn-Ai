import { analyzeDocumentContent } from './server/gemini.ts';

async function test() {
  const text = `
Table of Contents:
Chapter 1: The Cell (Page 4)
Chapter 2: Mitochondria (Page 12)
Chapter 3: Ribosomes (Page 20)
Chapter 4: Nucleus (Page 30)
Chapter 5: Cytoplasm (Page 40)
Chapter 6: Cell Wall (Page 50)
Chapter 7: Vacuole (Page 60)
Chapter 8: Chloroplasts (Page 70)
Chapter 9: Golgi Apparatus (Page 80)
Chapter 10: Endoplasmic Reticulum (Page 90)

Body:
This is a fake textbook. The cell is the basic unit of life.
`;
  const res = await analyzeDocumentContent({
    text,
    fileName: 'test.pdf'
  });
  console.log(JSON.stringify(res.chapters, null, 2));
}

test().catch(console.error);
