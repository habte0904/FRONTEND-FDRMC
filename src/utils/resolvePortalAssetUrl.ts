import api from "@/api/axios";

export const resolvePortalAssetUrl = (value?: string) => {
  if (!value) return value;
  if (value.startsWith("data:") || value.startsWith("blob:")) return value;

  let normalized = value.trim();

  // If the value is a bare filename or subdirectory without /uploads/
  if (!normalized.includes("/uploads/")) {
    if (normalized.startsWith("portal-") || normalized.startsWith("portal/")) {
      normalized = `/uploads/portal/${normalized.replace(/^portal\//, "")}`;
    } else if (normalized.startsWith("incident-") || normalized.startsWith("incidents/")) {
      normalized = `/uploads/incidents/${normalized.replace(/^incidents\//, "")}`;
    } else if (normalized.startsWith("news-") || normalized.startsWith("news/")) {
      normalized = `/uploads/news/${normalized.replace(/^news\//, "")}`;
    } else if (normalized.startsWith("inspection-certificate-") || normalized.startsWith("inspection-certificates/")) {
      normalized = `/uploads/inspection-certificates/${normalized.replace(/^inspection-certificates\//, "")}`;
    } else if (normalized.startsWith("profiles/")) {
      normalized = `/uploads/${normalized}`;
    }
  }

  const isBrowser = typeof window !== "undefined";
  const isRemoteClient =
    isBrowser &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  // If the URL contains '/uploads/', ensure it is prefixed with '/api/uploads/'
  // so Nginx's location /api/ rule forwards the GET request to the Node backend
  if (normalized.includes("/uploads/")) {
    const uploadsPath = normalized.substring(normalized.indexOf("/uploads/"));
    const apiUploadsPath = uploadsPath.startsWith("/api/uploads/")
      ? uploadsPath
      : `/api${uploadsPath}`;

    const apiBase = api.defaults.baseURL || "";

    // If client is on a remote server (e.g. addisfire.gov.et) and apiBase is localhost or empty,
    // use the current server's origin so the client doesn't call localhost
    if (isRemoteClient && (apiBase.includes("localhost") || apiBase.includes("127.0.0.1") || !apiBase)) {
      return `${window.location.origin}${apiUploadsPath}`;
    }

    if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
      const origin = apiBase.replace(/\/api\/?$/, "");
      return `${origin}${apiUploadsPath}`;
    }
    return apiUploadsPath;
  }

  // If a full absolute localhost URL was saved in the database during local testing
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    if (isRemoteClient && (normalized.includes("localhost:") || normalized.includes("127.0.0.1:"))) {
      const pathPart = normalized.replace(/^https?:\/\/[^/]+/, "");
      return `${window.location.origin}${pathPart}`;
    }
    return normalized;
  }

  return normalized;
};

