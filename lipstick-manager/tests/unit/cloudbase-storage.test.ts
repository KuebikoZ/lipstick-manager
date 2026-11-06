import { describe, expect, it } from "vitest";
import { normalizeCloudBaseSignedUploadUrl } from "@/lib/db/supabase-admin";

describe("CloudBase storage adapter", () => {
  it("normalizes the duplicated storage prefix and appends the upload token", () => {
    expect(
      normalizeCloudBaseSignedUploadUrl(
        "https://demo.api.tcloudbasegateway.com/v1/storages/v1/storages/object/upload/sign/lipstick-images/a.png",
        "temporary-token",
      ),
    ).toBe(
      "https://demo.api.tcloudbasegateway.com/v1/storages/object/upload/sign/lipstick-images/a.png?token=temporary-token",
    );
  });
});
