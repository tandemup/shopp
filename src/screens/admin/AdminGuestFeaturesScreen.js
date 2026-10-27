import React, { useState } from "react";
import { ActivityIndicator, Text, View, Alert } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import GuestFeaturesScreen from "@/src/screens/guest/GuestFeaturesScreen";

export default function AdminGuestFeaturesScreen() {
  const user = useQuery(api.users.current, {});
  const features = useQuery(api.guestSettings.get, {});
  const save = useMutation(api.guestSettings.set);
  const [saving, setSaving] = useState(false);
  const isAdmin = user?.isAdmin === true || user?.role === "admin";
  const onChange = async next => {
    if (!isAdmin || saving) return;
    setSaving(true);
    try { await save({ features: next }); }
    catch (error) { Alert.alert("No se han guardado los permisos", String(error?.message || error)); }
    finally { setSaving(false); }
  };
  if (user === undefined || (isAdmin && features === undefined)) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!isAdmin) return <View style={{ padding: 24 }}><Text>Acceso reservado al administrador.</Text></View>;
  return <GuestFeaturesScreen value={features} onChange={onChange} saving={saving} />;
}
