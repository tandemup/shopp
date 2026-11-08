import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const screens = ["ChatScreen.js", "ChatScreenResponsive.js", "YesterdayNewsScreen.js", "ChatPrototypeScreen.js"];

test("all four chat screens use provider-independent hooks", () => {
  for (const name of screens) {
    const code = read(`src/screens/chat/${name}`);
    assert.match(code, /useChatMessages\(/);
    assert.doesNotMatch(code, /convex\/react|_generated\/api|api\.chat\./);
  }
});
test("main chat preserves conditional subscription and room summaries", () => {
  const code = read("src/screens/chat/ChatScreen.js");
  assert.match(code, /computerMode === "library"\s*\? "skip"/);
  assert.match(code, /useChatRoomSummaries\(roomSummaryArgs\)/);
  assert.match(code, /getSharedPlaylist\(message\._id\)/);
});
test("Convex adapter preserves all chat operations", () => {
  const code = read("src/api/providers/convex/useChatBackend.js");
  for (const method of ["listMessages", "listRoomSummaries", "sendMessage", "deleteMessage", "deleteRoom", "updateYouTubeAlbum", "generateImageUploadUrl", "shareLocalPlaylist", "getSharedPlaylist", "refreshNewsYouTubePublishedDates"]) {
    assert.ok(code.includes(`api.chat.${method}`), `missing ${method}`);
  }
  assert.match(code, /useQuery\(api\.chat\.listMessages, args\)/);
});
test("chat contract defines realtime event names", () => {
  const code = read("src/api/contracts/chat.js");
  for (const ev of ["chat:message_created", "chat:message_deleted", "chat:room_updated", "chat:room_deleted"]) assert.ok(code.includes(ev));
});
