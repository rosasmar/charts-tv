import { describe, expect, it } from "vitest";
import {
  MAX_BACKGROUND_BYTES,
  checkUploadBody,
  checkUploadHeaders,
  coverCrop,
  isValidOpacity,
} from "./background";

const JPEG_START = [0xff, 0xd8, 0xff, 0xe0];

describe("coverCrop", () => {
  it("scales a large 16:9 photo down to 1920×1080 without cropping", () => {
    expect(coverCrop(3840, 2160)).toEqual({ sx: 0, sy: 0, sw: 3840, sh: 2160, width: 1920, height: 1080 });
  });

  it("crops a 4:3 photo top and bottom to 16:9", () => {
    expect(coverCrop(4032, 3024)).toEqual({ sx: 0, sy: 378, sw: 4032, sh: 2268, width: 1920, height: 1080 });
  });

  it("crops a portrait photo to a band across its middle", () => {
    expect(coverCrop(3024, 4032)).toEqual({ sx: 0, sy: 1166, sw: 3024, sh: 1701, width: 1920, height: 1080 });
  });

  it("crops a panorama at the sides", () => {
    expect(coverCrop(8000, 2000)).toMatchObject({ sx: 2222, sy: 0, sw: 3556, sh: 2000, width: 1920, height: 1080 });
  });

  it("never upscales a small photo", () => {
    expect(coverCrop(1280, 720)).toEqual({ sx: 0, sy: 0, sw: 1280, sh: 720, width: 1280, height: 720 });
  });
});

describe("isValidOpacity", () => {
  it("accepts whole numbers from 0 to 100", () => {
    expect([0, 35, 100].every(isValidOpacity)).toBe(true);
  });

  it("rejects anything else", () => {
    expect([-1, 101, 40.5, NaN].some(isValidOpacity)).toBe(false);
  });
});

describe("checkUploadHeaders", () => {
  it("accepts a JPEG within the cap", () => {
    expect(checkUploadHeaders("K7P2QX", "image/jpeg", "500000")).toBeNull();
  });

  it("accepts a missing Content-Length (the body is checked after reading)", () => {
    expect(checkUploadHeaders("K7P2QX", "image/jpeg", null)).toBeNull();
  });

  it("rejects a malformed pairing code", () => {
    expect(checkUploadHeaders("k7p2qx", "image/jpeg", "500000")).toEqual({ status: 400, error: "bad_request" });
  });

  it("rejects other content types", () => {
    for (const type of [null, "image/png", "application/json", "multipart/form-data"]) {
      expect(checkUploadHeaders("K7P2QX", type, "500000")).toMatchObject({ status: 415 });
    }
  });

  it("ignores content-type parameters and case", () => {
    expect(checkUploadHeaders("K7P2QX", "Image/JPEG; foo=bar", "500000")).toBeNull();
  });

  it("rejects a declared size over the cap", () => {
    expect(checkUploadHeaders("K7P2QX", "image/jpeg", String(MAX_BACKGROUND_BYTES + 1))).toEqual({
      status: 413,
      error: "too_large",
    });
  });
});

describe("checkUploadBody", () => {
  it("accepts a JPEG within the cap", () => {
    expect(checkUploadBody(new Uint8Array([...JPEG_START, 0, 0]))).toBeNull();
  });

  it("accepts exactly the cap", () => {
    const bytes = new Uint8Array(MAX_BACKGROUND_BYTES);
    bytes.set(JPEG_START);
    expect(checkUploadBody(bytes)).toBeNull();
  });

  it("rejects an empty body", () => {
    expect(checkUploadBody(new Uint8Array())).toEqual({ status: 400, error: "bad_request" });
  });

  it("rejects a body over the cap", () => {
    const bytes = new Uint8Array(MAX_BACKGROUND_BYTES + 1);
    bytes.set(JPEG_START);
    expect(checkUploadBody(bytes)).toEqual({ status: 413, error: "too_large" });
  });

  it("rejects bytes that aren't a JPEG", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(checkUploadBody(png)).toEqual({ status: 415, error: "unsupported_media_type" });
  });
});
