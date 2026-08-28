import { describe, expect, it } from "vitest";

import { validatePublicEnvironment } from "./environment";

const validEnvironment = {
  supabaseUrl: "https://exampleproject.supabase.co",
  supabasePublishableKey: "sb_publishable_example",
};

describe("public environment validation", () => {
  it("accepts a hosted Supabase URL and publishable key", () => {
    expect(validatePublicEnvironment(validEnvironment)).toEqual(
      validEnvironment,
    );
  });

  it("rejects a non-hosted or insecure backend", () => {
    expect(() =>
      validatePublicEnvironment({
        ...validEnvironment,
        supabaseUrl: "http://localhost:54321",
      }),
    ).toThrow(/hosted supabase\.co project/);
  });

  it("rejects a server secret in the browser key field", () => {
    expect(() =>
      validatePublicEnvironment({
        ...validEnvironment,
        supabasePublishableKey: "sb_secret_example",
      }),
    ).toThrow(/publishable key/);
  });
});
