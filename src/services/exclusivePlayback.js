// Serializes audio ownership, including asynchronous native WebView acknowledgements.
// A failed pause never grants the new player permission to unmute.
export function createExclusivePlayback() {
  const players = new Map();
  let wanted = null;
  let revision = 0;
  let queue = Promise.resolve();
  return {
    register(id, suspend) {
      players.set(id, suspend);
      return () => {
        players.delete(id);
        if (wanted === id) { wanted = null; revision += 1; }
      };
    },
    claim(id) {
      wanted = id;
      const ticket = ++revision;
      const result = queue.then(async () => {
        if (ticket !== revision || !players.has(id)) return false;
        await Promise.all([...players].filter(([key]) => key !== id).map(([, suspend]) => suspend()));
        return ticket === revision && wanted === id && players.has(id);
      });
      queue = result.catch(() => {});
      return result;
    },
    owns(id) { return wanted === id && players.has(id); },
  };
}

export const exclusivePlayback = createExclusivePlayback();
