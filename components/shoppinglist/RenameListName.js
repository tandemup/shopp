const renameList = (listId, newName) => {
  setActiveLists((prev) =>
    prev.map((l) => (l.id === listId ? { ...l, name: newName } : l))
  );
};
