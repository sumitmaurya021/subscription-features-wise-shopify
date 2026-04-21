import fs from "node:fs/promises";
import path from "node:path";
import { authenticate } from "../shopify.server";

function formatTitle(handle) {
  return handle
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractSchema(liquidContent) {
  const match = liquidContent.match(
    /{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/i
  );

  if (!match) return null;

  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

async function findBlockFiles(rootDir) {
  let files = [];

  let entries = [];
  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "blocks") {
        const blockEntries = await fs.readdir(fullPath, {
          withFileTypes: true,
        });

        for (const blockEntry of blockEntries) {
          if (blockEntry.isFile() && blockEntry.name.endsWith(".liquid")) {
            files.push(path.join(fullPath, blockEntry.name));
          }
        }
      } else {
        const nestedFiles = await findBlockFiles(fullPath);
        files = files.concat(nestedFiles);
      }
    }
  }

  return files;
}

function inferWidgetType(schema) {
  const target = String(schema?.target || "").toLowerCase();

  if (["head", "body", "compliance_head"].includes(target)) {
    return "app_embed";
  }

  return "app_block";
}

function inferDefaultTemplate(handle, schema) {
  if (Array.isArray(schema?.templates) && schema.templates.length > 0) {
    return schema.templates[0];
  }

  const value = handle.toLowerCase();

  if (
    value.includes("product") ||
    value.includes("review") ||
    value.includes("rating") ||
    value.includes("star") ||
    value.includes("write")
  ) {
    return "product";
  }

  if (value.includes("collection")) {
    return "collection";
  }

  if (value.includes("article")) {
    return "article";
  }

  if (value.includes("blog")) {
    return "blog";
  }

  return "index";
}

function getDescription(handle, title) {
  const value = `${handle} ${title}`.toLowerCase();

  if (
    value.includes("star") ||
    value.includes("rating") ||
    value.includes("badge")
  ) {
    return "Show the average rating of your products and how many reviews they've received.";
  }

  if (
    value.includes("write") ||
    value.includes("form") ||
    value.includes("submit")
  ) {
    return "A pre-installed widget to help your customers write reviews.";
  }

  if (value.includes("carousel")) {
    return "Show reviews inside a beautiful sliding carousel layout.";
  }

  if (value.includes("snippet")) {
    return "Display a compact review summary snippet on your storefront.";
  }

  if (value.includes("gallery") || value.includes("media") || value.includes("photo")) {
    return "Highlight customer review media in a clean gallery layout.";
  }

  if (value.includes("card") || value.includes("grid")) {
    return "Display customer reviews in a card-style layout.";
  }

  return "Collect and display product reviews on your product pages.";
}

function inferPreviewVariant(handle, title) {
  const value = `${handle} ${title}`.toLowerCase();

  if (
    value.includes("write") ||
    value.includes("form") ||
    value.includes("submit")
  ) {
    return "write-review";
  }

  if (
    value.includes("star rating") ||
    value.includes("rating badge") ||
    value.includes("rating") ||
    value.includes("stars") ||
    value.includes("badge")
  ) {
    return value.includes("badge") ? "badge" : "rating-badge";
  }

  if (value.includes("snippet") || value.includes("summary")) {
    return "snippet";
  }

  if (value.includes("gallery") || value.includes("media") || value.includes("photo")) {
    return "gallery";
  }

  if (value.includes("carousel") || value.includes("slider")) {
    return "carousel";
  }

  if (value.includes("card") || value.includes("grid")) {
    return "review-cards";
  }

  if (value.includes("list")) {
    return "list";
  }

  return "reviews";
}

function filenameToTemplate(filename) {
  if (!filename || !filename.startsWith("templates/")) return null;
  return path.basename(filename, ".json");
}

function buildThemeEditorBase(shop) {
  return `https://${shop}/admin/themes/current/editor`;
}

function buildCustomizeUrl({ shop, kind, template }) {
  const url = new URL(buildThemeEditorBase(shop));

  if (kind === "app_embed") {
    url.searchParams.set("context", "apps");
    return url.toString();
  }

  url.searchParams.set("template", template || "product");
  return url.toString();
}

function buildInstallUrl({ shop, kind, template, apiKey, handle }) {
  if (!shop || !apiKey || !handle) return null;

  const url = new URL(buildThemeEditorBase(shop));

  if (kind === "app_embed") {
    url.searchParams.set("context", "apps");
    url.searchParams.set("activateAppId", `${apiKey}/${handle}`);
    return url.toString();
  }

  url.searchParams.set("template", template || "product");
  url.searchParams.set("addAppBlockId", `${apiKey}/${handle}`);
  url.searchParams.set("target", "newAppsSection");
  return url.toString();
}

function createBlockMatchers(handle, apiKey) {
  const escapedHandle = handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAppKey = String(apiKey || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return [
    new RegExp(`/blocks/${escapedHandle}/`, "i"),
    new RegExp(`"${escapedHandle}"`, "i"),
    escapedAppKey
      ? new RegExp(`${escapedAppKey}/${escapedHandle}`, "i")
      : null,
  ].filter(Boolean);
}

function detectInstalledState({ handle, kind, apiKey, themeFiles }) {
  if (!Array.isArray(themeFiles) || themeFiles.length === 0) {
    return {
      installed: false,
      matchedTemplate: null,
    };
  }

  const matchers = createBlockMatchers(handle, apiKey);

  const relevantFiles =
    kind === "app_embed"
      ? themeFiles.filter((file) => file.filename === "config/settings_data.json")
      : themeFiles.filter(
          (file) =>
            file.filename.startsWith("templates/") ||
            file.filename.startsWith("sections/")
        );

  for (const file of relevantFiles) {
    const content = String(file.content || "");
    const isMatch = matchers.some((matcher) => matcher.test(content));

    if (isMatch) {
      return {
        installed: true,
        matchedTemplate: filenameToTemplate(file.filename),
      };
    }
  }

  return {
    installed: false,
    matchedTemplate: null,
  };
}

async function fetchMainThemeFiles(admin) {
  const collectedFiles = [];
  let after = null;
  let hasNextPage = true;
  let themeMeta = null;

  while (hasNextPage) {
    const response = await admin.graphql(
      `#graphql
        query MainThemeFiles($after: String) {
          themes(first: 1, roles: [MAIN]) {
            nodes {
              id
              name
              role
              files(
                first: 100
                after: $after
                filenames: ["templates/*.json", "sections/*.json", "config/settings_data.json"]
              ) {
                nodes {
                  filename
                  body {
                    ... on OnlineStoreThemeFileBodyText {
                      content
                    }
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        }
      `,
      {
        variables: { after },
      }
    );

    const result = await response.json();

    if (result.errors?.length) {
      throw new Error(result.errors.map((error) => error.message).join(", "));
    }

    const theme = result.data?.themes?.nodes?.[0];

    if (!theme) {
      return {
        theme: null,
        files: [],
      };
    }

    themeMeta = {
      id: theme.id,
      name: theme.name,
      role: theme.role,
    };

    const filesConnection = theme.files;
    const nodes = Array.isArray(filesConnection?.nodes)
      ? filesConnection.nodes
      : [];

    for (const node of nodes) {
      collectedFiles.push({
        filename: node.filename,
        content: node.body?.content || "",
      });
    }

    hasNextPage = Boolean(filesConnection?.pageInfo?.hasNextPage);
    after = filesConnection?.pageInfo?.endCursor || null;
  }

  return {
    theme: themeMeta,
    files: collectedFiles,
  };
}

export async function getWidgetsData(request) {
  const { admin, session } = await authenticate.admin(request);
 
  const shop = session.shop;
  const apiKey =
    process.env.SHOPIFY_API_KEY?.trim?.() ||
    process.env.SHOPIFY_API_KEY ||
    "";

  const extensionsDir = path.join(process.cwd(), "extensions");
  const blockFiles = await findBlockFiles(extensionsDir);

  let themeFiles = [];
  try {
    const themeData = await fetchMainThemeFiles(admin);
    themeFiles = themeData.files;
  } catch {
    themeFiles = [];
  }

  const widgets = [];

  for (const filePath of blockFiles) {
    const source = await fs.readFile(filePath, "utf8");
    const schema = extractSchema(source);
    const handle = path.basename(filePath, ".liquid");
    const title = schema?.name || formatTitle(handle);
    const kind = inferWidgetType(schema);
    const defaultTemplate = inferDefaultTemplate(handle, schema);

    const detection = detectInstalledState({
      handle,
      kind,
      apiKey,
      themeFiles,
    });

    const templateForLinks = detection.matchedTemplate || defaultTemplate;

    widgets.push({
      id: handle,
      handle,
      kind,
      title,
      description: getDescription(handle, title),
      templates: Array.isArray(schema?.templates) ? schema.templates : [],
      installed: detection.installed,
      previewVariant: inferPreviewVariant(handle, title),
      customizeUrl: buildCustomizeUrl({
        shop,
        kind,
        template: templateForLinks,
      }),
      installUrl: buildInstallUrl({
        shop,
        kind,
        template: templateForLinks,
        apiKey,
        handle,
      }),
    });
  }

  widgets.sort((a, b) => a.title.localeCompare(b.title));

  return { widgets };
}
