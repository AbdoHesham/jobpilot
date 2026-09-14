import { HttpError, json, requireEnv, serve } from "../_shared/util.ts";

const MAX_DESCRIPTION = 5000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

Deno.serve(
  serve(async (req, db, userId) => {
    const body = await req.json().catch(() => ({}));
    const description = typeof body.description === "string"
      ? body.description.trim()
      : "";
    if (description.length < 10 || description.length > MAX_DESCRIPTION) {
      throw new HttpError(
        400,
        "Description must be between 10 and 5,000 characters.",
      );
    }

    let imageLine = "";
    if (body.image !== null && body.image !== undefined) {
      if (typeof body.image !== "string") {
        throw new HttpError(400, "Invalid image.");
      }
      const match = body.image.match(
        /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/,
      );
      if (!match) throw new HttpError(400, "Image must be a PNG, JPG or WebP.");

      const bytes = Uint8Array.from(
        atob(match[2]),
        (char) => char.charCodeAt(0),
      );
      if (bytes.length > MAX_IMAGE_BYTES) {
        throw new HttpError(400, "Image must be smaller than 3 MB.");
      }

      const path = `${userId}/${crypto.randomUUID()}.${IMAGE_TYPES[match[1]]}`;
      const upload = await db.storage
        .from("issue-images")
        .upload(path, bytes, { contentType: match[1] });
      if (upload.error) throw new Error(upload.error.message);
      const signed = await db.storage
        .from("issue-images")
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      if (signed.error) throw new Error(signed.error.message);
      imageLine =
        `\n\n### Screenshot\n[Open attached screenshot](${signed.data.signedUrl}) _(link expires in 30 days)_`;
    }

    const repository = Deno.env.get("GITHUB_REPOSITORY") ??
      "AbdoHesham/jobpilot";
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
      throw new Error("invalid GITHUB_REPOSITORY");
    }
    const title = `User report: ${
      description.split(/\r?\n/, 1)[0].slice(0, 80)
    }`;
    const metadata = [
      typeof body.page_url === "string"
        ? `Page: ${body.page_url.slice(0, 500)}`
        : "",
      typeof body.user_agent === "string"
        ? `Browser: ${body.user_agent.slice(0, 500)}`
        : "",
      `Reporter: ${userId}`,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(
      `https://api.github.com/repos/${repository}/issues`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${requireEnv("GITHUB_TOKEN")}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          title,
          labels: ["user-report"],
          body:
            `${description}${imageLine}\n\n<details><summary>Technical details</summary>\n\n${metadata}\n\n</details>`,
        }),
      },
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 403) {
        const accepted =
          response.headers.get("x-accepted-github-permissions") ??
            "issues=write";
        throw new HttpError(
          502,
          `GitHub token cannot create issues in ${repository}. Grant this repository to the token with ${accepted}.`,
        );
      }
      throw new Error(
        `GitHub rejected the report: ${error.message ?? response.status}`,
      );
    }

    const issue = await response.json();
    return json({ issue_url: issue.html_url });
  }),
);
