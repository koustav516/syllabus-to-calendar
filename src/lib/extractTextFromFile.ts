// src/lib/extractTextFromFile.ts
import fs from "fs/promises";
import path from "path";

/**
 * Options for extraction
 */
export type ExtractOptions = {
    removeHeaderFooter?: boolean;
    fallbackYear?: number;
    ocr?: boolean;
};

type PdfParseResult = {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    version?: string;
};
type PdfParseFunc = (
    data: Buffer | Uint8Array | ArrayBuffer
) => Promise<PdfParseResult>;

type MammothExtractRawText = (opts: {
    buffer: Buffer | Uint8Array | ArrayBuffer;
}) => Promise<{ value: string }>;
type MammothConvertToHtml = (opts: {
    buffer: Buffer | Uint8Array | ArrayBuffer;
}) => Promise<{ value: string }>;

type MammothModuleShape = {
    extractRawText?: MammothExtractRawText;
    convertToHtml?: MammothConvertToHtml;
    default?: {
        extractRawText?: MammothExtractRawText;
        convertToHtml?: MammothConvertToHtml;
    };
};

/**
 * Read a local file path or accept a Buffer. Provide filename so extension can be detected.
 */
export async function extractTextFromFile(
    fileOrBuffer: Buffer | string,
    filename?: string,
    opts: ExtractOptions = {}
): Promise<string> {
    const removeHeaderFooter = opts.removeHeaderFooter ?? true;

    let buffer: Buffer;
    let name = filename;

    if (typeof fileOrBuffer === "string") {
        const filePath = fileOrBuffer;
        buffer = await fs.readFile(filePath);
        name = name ?? path.basename(filePath);
    } else {
        buffer = fileOrBuffer;
        if (!name)
            throw new Error(
                'When passing a Buffer you must provide a filename to detect file type (e.g., "syllabus.pdf")'
            );
    }

    const ext = (path.extname(name) || "").replace(/^\./, "").toLowerCase();

    let rawText = "";

    if (ext === "txt" || ext === "md" || ext === "text") {
        rawText = buffer.toString("utf8");
    } else if (ext === "pdf") {
        // dynamically import pdf-parse and type it as PdfParseFunc without any `any`
        const pdfParseModuleImported = await import("pdf-parse");
        // module may export function as default or as module itself
        const pdfParseCandidate = pdfParseModuleImported as unknown as
            | { default?: PdfParseFunc }
            | PdfParseFunc;
        const pdfParse: PdfParseFunc =
            typeof (pdfParseCandidate as PdfParseFunc) === "function"
                ? (pdfParseCandidate as PdfParseFunc)
                : (pdfParseCandidate as { default?: PdfParseFunc }).default ??
                  ((): Promise<PdfParseResult> =>
                      Promise.resolve({ text: "" })); // fallback (shouldn't happen)

        const data = await pdfParse(buffer);
        rawText = data.text ?? "";
    } else if (ext === "docx") {
        const mammothModuleImported = await import("mammoth");
        const mammoth = mammothModuleImported as unknown as MammothModuleShape;

        const extractor =
            mammoth.extractRawText ?? mammoth.default?.extractRawText;

        if (typeof extractor === "function") {
            const result = await extractor({ buffer });
            rawText = result.value ?? "";
        } else {
            const converter =
                mammoth.convertToHtml ?? mammoth.default?.convertToHtml;
            if (typeof converter === "function") {
                const result = await converter({ buffer });
                rawText = (result.value ?? "").replace(/<\/?[^>]+(>|$)/g, " ");
            } else {
                // fallback to plain text
                rawText = buffer.toString("utf8");
            }
        }
    } else {
        rawText = buffer.toString("utf8");
    }

    const normalized = normalizeSyllabusText(rawText, { removeHeaderFooter });
    return normalized;
}

function normalizeSyllabusText(
    text: string,
    opts: { removeHeaderFooter: boolean }
): string {
    if (!text) return "";

    let t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    t = t.replace(/\t/g, " ").replace(/[ \u00A0]{2,}/g, " ");

    const rawLines = t.split("\n").map((l) => l.trim());

    while (rawLines.length > 0 && rawLines[0] === "") rawLines.shift();
    while (rawLines.length > 0 && rawLines[rawLines.length - 1] === "")
        rawLines.pop();

    const freq = new Map<string, number>();
    for (const line of rawLines) {
        const short = line.length > 200 ? line.slice(0, 200) : line;
        if (!short) continue;
        freq.set(short, (freq.get(short) ?? 0) + 1);
    }

    const repeatedLines = new Set<string>();
    for (const [line, count] of freq.entries()) {
        if (count > 2 && line.length <= 120 && !/^[\d\W]+$/.test(line)) {
            repeatedLines.add(line);
        }
    }

    const filteredLines = rawLines.filter((line) => {
        if (!opts.removeHeaderFooter) return true;
        if (/^page\s*\d+$/i.test(line) || /^\d{1,3}$/.test(line)) return false;
        if (repeatedLines.has(line)) return false;
        return true;
    });

    const collapsed: string[] = [];
    let prevBlank = false;
    for (const l of filteredLines) {
        if (l === "") {
            if (!prevBlank) collapsed.push("");
            prevBlank = true;
        } else {
            collapsed.push(l);
            prevBlank = false;
        }
    }

    return collapsed.join("\n").trim();
}
