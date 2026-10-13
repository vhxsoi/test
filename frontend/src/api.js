let session;
export async function getSession() {
  if (!session) {
    const response = await fetch("/api/session", { cache: "no-store" });
    if (!response.ok) throw new Error("로컬 서버에 연결하지 못했습니다.");
    session = await response.json();
  }
  return session;
}
export async function api(path, method = "GET", body) {
  const auth = await getSession();
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Worknote-Token": auth.token,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 403) session = null;
    throw new Error(data.error || "요청을 처리하지 못했습니다.");
  }
  return data;
}
export function download(name, data, type = "application/json") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
