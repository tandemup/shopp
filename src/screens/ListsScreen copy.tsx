export default function ListsScreen() {
  const { lists, addList } = useShopStore();
  const [counter, setCounter] = useState(1);

  const activeLists = lists.filter((l) => !l.archived);

  const handleCreateList = () => {
    const name = `Lista ${counter}`;
    addList(name);
    setCounter((c) => c + 1);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Listas</Text>

      <FlatList
        data={activeLists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/list/${item.id}`)}
          >
            <Text style={styles.cardText}>{item.name}</Text>
          </Pressable>
        )}
      />

      <Pressable style={styles.button} onPress={handleCreateList}>
        <Text style={styles.buttonText}>Crear nueva lista</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
  },
  card: {
    padding: 16,
    backgroundColor: "#f2f2f2",
    borderRadius: 8,
    marginBottom: 10,
  },
  cardText: {
    fontSize: 16,
  },
  button: {
    padding: 16,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
});
