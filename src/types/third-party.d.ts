// src/types/third-party.d.ts
// Minimal TS declarations without using `any`.

declare module "pdf-parse" {
    export default function pdfParse(
        data: Buffer | Uint8Array | ArrayBuffer
    ): Promise<{
        text: string;
        numpages?: number;
        numrender?: number;
        info?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
        version?: string;
    }>;
}

declare module "mammoth" {
    export function extractRawText(options: {
        buffer: Buffer | Uint8Array | ArrayBuffer;
    }): Promise<{ value: string }>;
    export function convertToHtml(options: {
        buffer: Buffer | Uint8Array | ArrayBuffer;
    }): Promise<{ value: string }>;
    const _default: {
        extractRawText: typeof extractRawText;
        convertToHtml: typeof convertToHtml;
    };
    export default _default;
}
