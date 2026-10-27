import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import GuestFeaturesScreen from "@/src/screens/guest/GuestFeaturesScreen";

const KEY = "@shopp:guest:features:v1";
const DEFAULTS = { compras: true, alimentos: true, musica: true };

export default function AdminGuestFeaturesScreen() {
  const user = useQuery(api.users.current, {});
  const isAdmin = user?.isAdmin === true || user?.role === "admin";
  const [value, setValue] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    AsyncStorage.getItem(KEY).then(raw => {
      if (!active || !raw) return;
      const saved = JSON.parse(raw);
      setValue({ compras: saved.compras !== false, alimentos: saved.alimentos !== false, musica: saved.musica !== false });
    }).catch(error => console.warn("No se pudo leer la configuración de invitado", error))
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [isAdmin]);

  const onChange = async next => {
    if (!isAdmin) return;
    setValue(next);
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); }
    catch (error) { console.warn("No se pudo guardar la configuración de invitado", error); }
  };

  if (user === undefined || (isAdmin && !ready)) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!isAdmin) return <View style={{ padding: 24 }}><Text>Acceso reservado al administrador.</Text></View>;
  return <GuestFeaturesScreen value={value} onChange={onChange} />;
}
