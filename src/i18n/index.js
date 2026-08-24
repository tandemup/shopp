import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Text as RNText, TextInput as RNTextInput } from "react-native";
import { storage } from "@/src/storage/storage";
import { STORAGE_KEYS } from "@/src/storage/storageKeys";

const DEFAULT_LANGUAGE = "es";
let activeLanguage = DEFAULT_LANGUAGE;

const EN = {
  Configuración: "Settings",
  Settings: "Settings",
  Cuenta: "Account",
  "Mi perfil": "My profile",
  "Editar alias público, teléfono y privacidad de Parking":
    "Edit public alias, phone number and Parking privacy",
  "Administrar usuarios": "Manage users",
  "Consultar usuarios y asignar roles": "View users and assign roles",
  "Cerrar sesión": "Sign out",
  "Salir de tu cuenta de Shopp en este dispositivo":
    "Sign out of your Shopp account on this device",
  Escáner: "Scanner",
  Scanner: "Scanner",
  "Historial de escaneos": "Scan history",
  "Consulta los códigos escaneados recientemente":
    "View recently scanned codes",
  Datos: "Data",
  "Exportar datos a JSON": "Export data to JSON",
  "Genera un fichero con datos del usuario, listas, historial de compras e historial de escaneos":
    "Create a file containing user data, lists, purchase history and scan history",
  "Migración temporal": "Temporary migration",
  "Subir items locales a Convex": "Upload local items to Convex",
  "Lee los items de AsyncStorage y los guarda en una tabla temporal":
    "Read items from AsyncStorage and save them to a temporary table",
  Permisos: "Permissions",
  "Accesos del dispositivo": "Device access",
  "Cámara, micrófono, ubicación y permisos necesarios para la app":
    "Camera, microphone, location and permissions required by the app",
  Cámara: "Camera",
  "Necesaria para escanear códigos de barras.": "Required to scan barcodes.",
  Micrófono: "Microphone",
  "Necesario solo si grabas vídeo con audio.":
    "Only required if you record video with audio.",
  Ubicación: "Location",
  "Necesaria para tiendas cercanas y mapas.":
    "Required for nearby stores and maps.",
  Email: "Email",
  "Contacto con administración": "Contact administration",
  "Usuario autenticado": "Signed-in user",
  "Email no disponible": "Email unavailable",
  "Cargando usuario...": "Loading user...",
  "Obteniendo datos de Convex Auth": "Getting data from Convex Auth",
  "Comprobando...": "Checking...",
  Concedido: "Granted",
  Bloqueado: "Blocked",
  Denegado: "Denied",
  "No solicitado": "Not requested",
  Tiendas: "Stores",
  Tienda: "Store",
  "Tienda seleccionada": "Selected store",
  Todas: "All",
  Cerca: "Nearby",
  Favoritas: "Favorites",
  Mapa: "Map",
  Información: "Information",
  Listas: "Lists",
  Lista: "List",
  "Nueva lista": "New list",
  "Crear lista": "Create list",
  "Listas archivadas": "Archived lists",
  Archivar: "Archive",
  Desarchivar: "Unarchive",
  "Historial de compras": "Purchase history",
  Compras: "Purchases",
  Producto: "Product",
  Productos: "Products",
  "Nuevo producto": "New product",
  "Editar producto": "Edit product",
  "Información del producto": "Product information",
  Nombre: "Name",
  Cantidad: "Quantity",
  Precio: "Price",
  "Precio unitario": "Unit price",
  Categoría: "Category",
  Subcategoría: "Subcategory",
  Notas: "Notes",
  Guardar: "Save",
  Cancelar: "Cancel",
  Cerrar: "Close",
  Eliminar: "Delete",
  Borrar: "Delete",
  Editar: "Edit",
  Añadir: "Add",
  Agregar: "Add",
  Buscar: "Search",
  "Buscar producto": "Search product",
  "Motor de búsqueda": "Search engine",
  "Motores de búsqueda": "Search engines",
  "Motores de búsqueda para productos": "Product search engines",
  "Código de barras": "Barcode",
  "Leer código de barras": "Scan barcode",
  Escanear: "Scan",
  "Escanear nuevo producto": "Scan new product",
  "Escanear nuevo producto2": "Scan new product",
  "Editar escaneo": "Edit scan",
  "Apunta al código de barras": "Point at the barcode",
  "El número se procesará automáticamente cuando sea detectado.":
    "The number will be processed automatically when detected.",
  "Iniciando cámara...": "Starting camera...",
  "Preparando cámara...": "Preparing camera...",
  "Permiso de cámara necesario": "Camera permission required",
  "Permite el acceso a la cámara para leer el código EAN-13 del producto.":
    "Allow camera access to read the product's EAN-13 code.",
  "Permitir cámara": "Allow camera",
  "Opciones del código de barras": "Barcode options",
  "Copiar código": "Copy code",
  "Código copiado": "Code copied",
  "No se pudo copiar el código de barras al portapapeles.":
    "The barcode could not be copied to the clipboard.",
  Imagen: "Image",
  "Pegar imagen": "Paste image",
  "Eliminar imagen": "Delete image",
  "Cambiar imagen": "Change image",
  "Seleccionar imagen": "Select image",
  Historial: "History",
  Vacío: "Empty",
  "Sin resultados": "No results",
  "No hay resultados": "No results",
  "Cargando...": "Loading...",
  "Cargando Shopp...": "Loading Shopp...",
  Error: "Error",
  Aceptar: "OK",
  Sí: "Yes",
  No: "No",
  Volver: "Back",
  Continuar: "Continue",
  Siguiente: "Next",
  Anterior: "Previous",
  Enviar: "Send",
  Chat: "Chat",
  Trabajo: "Work",
  Ciudad: "City",
  Ofertas: "Deals",
  Música: "Music",
  Musica: "Music",
  Humor: "Humor",
  Informática: "Computing",
  Informatica: "Computing",
  Noticias: "News",
  Supermercado: "Groceries",
  Libros: "Books",
  Menú: "Menu",
  Menu: "Menu",
  Perfil: "Profile",
  Ajustes: "Settings",
  "Ajustes de parking": "Parking settings",
  Parking: "Parking",
  Idioma: "Language",
  Español: "Spanish",
  Inglés: "English",
  "Tutor de Inglés": "English Tutor",
  "Practica describiendo fotografías": "Practise by describing photographs",
  "Idioma de la aplicación": "App language",
  "Selecciona el idioma de la interfaz": "Choose the interface language",
  "Exportación completada": "Export completed",
  "Error al exportar": "Export error",
  "Acceso restringido": "Restricted access",
  "Solo los administradores pueden subir items a Convex.":
    "Only administrators can upload items to Convex.",
  "Sin items para subir": "No items to upload",
  "No se encontraron items en el almacenamiento local de la aplicación.":
    "No items were found in the app's local storage.",
  "Importación completada": "Import completed",
  "Error al subir items": "Error uploading items",
  "Recargar tiendas": "Reload stores",
  "Borrar almacenamiento": "Clear storage",
  "Borrar todo": "Delete all",
  "Danger Zone": "Danger Zone",
  "Borrar listas activas": "Delete active lists",
  "Borrar listas archivadas": "Delete archived lists",
  "Borrar historial de compras": "Delete purchase history",
  "Borrar historial de escaneos": "Delete scan history",
  "Borrar almacenamiento completo": "Clear all storage",
  "¿Seguro?": "Are you sure?",
  "¿Quieres cerrar tu sesión de Shopp?": "Do you want to sign out of Shopp?",
  "Ubicación no disponible": "Location unavailable",
  "Este navegador no permite usar geolocalización.":
    "This browser does not support geolocation.",
  "Shopp no necesita micrófono para escanear códigos de barras.":
    "Shopp does not need microphone access to scan barcodes.",
  "Productos pendientes de revisión": "Products pending review",
  "Restablecer contraseña": "Reset password",
  "Iniciar sesión": "Sign in",
  Registrarse: "Sign up",
  "Correo electrónico": "Email address",
  Contraseña: "Password",
  "Nueva contraseña": "New password",
  "Confirmar contraseña": "Confirm password",
  "Olvidé mi contraseña": "Forgot password",
  Comprar: "Buy",
  Total: "Total",
  Ahorro: "Savings",
  Comprado: "Purchased",
  Pendiente: "Pending",
  "Última tienda:": "Last store:",
  Usuario: "User",
};

Object.assign(EN, {
  ACCIONES: "ACTIONS",
  ADMINISTRACIÓN: "ADMINISTRATION",
  "Abre el código de barras en un buscador externo.":
    "Open the barcode in an external search engine.",
  "Abrir en Google Maps": "Open in Google Maps",
  "Abrir fuente": "Open source",
  "Abrir la cámara para leer un código de barras.":
    "Open the camera to scan a barcode.",
  "Accede con tu cuenta para mantener tus datos guardados.":
    "Sign in to keep your data saved.",
  "Accede con tu email y contraseña para continuar.":
    "Sign in with your email and password to continue.",
  "Acceso protegido mediante verificación por email.":
    "Access protected by email verification.",
  "Accesos rápidos": "Quick access",
  "Acciones rápidas": "Quick actions",
  "Activa solo los formatos que realmente quieras detectar.":
    "Enable only the formats you actually want to detect.",
  Actividad: "Activity",
  Activo: "Active",
  Actualización: "Update",
  "Actualizar desde internet": "Update from internet",
  "Ajustes del chat": "Chat settings",
  "Al coche": "To car",
  "Al destino": "To destination",
  Alias: "Alias",
  "Alias público": "Public alias",
  Aplicar: "Apply",
  "Aplicar datos del JSON": "Apply JSON data",
  Aprobar: "Approve",
  Asunto: "Subject",
  "Avatar actual": "Current avatar",
  "Añade los productos que necesitas y mantén organizada tu próxima compra.":
    "Add the products you need and keep your next shopping trip organized.",
  "Añade productos desde el buscador o recupera productos del historial.":
    "Add products from search or retrieve products from history.",
  "Añadir a nueva lista": "Add to new list",
  "Añadir producto": "Add product",
  "Busca tiendas próximas a tu ubicación actual.":
    "Find stores near your current location.",
  "Busca tiendas, consulta las más cercanas y marca tus favoritas.":
    "Find stores, view the nearest ones and mark your favorites.",
  "Buscador de productos": "Product search",
  "Buscando producto...": "Searching for product...",
  "Buscando tiendas cercanas…": "Searching nearby stores…",
  "Buscar con Google Modo IA": "Search with Google AI Mode",
  "Buscar el código de barras en el motor seleccionado":
    "Search the barcode with the selected engine",
  "Buscar en Google Shopping": "Search on Google Shopping",
  "Buscar más información": "Search for more information",
  "Buscar producto en Google": "Search product on Google",
  "BÚSQUEDA EXTERNA": "EXTERNAL SEARCH",
  Básico: "Basic",
  Búsqueda: "Search",
  "Caché activa": "Cache enabled",
  "Caché de imagen activa": "Image cache enabled",
  Cambiar: "Change",
  "Cambiar correo electrónico": "Change email address",
  "Cambiar datos": "Change data",
  "Cambiar estado": "Change status",
  "Cargando ajustes...": "Loading settings...",
  "Cargando destinos…": "Loading destinations…",
  "Cargando mediciones…": "Loading measurements…",
  "Cargando mensajes...": "Loading messages...",
  "Cargando perfil...": "Loading profile...",
  "Cargando revisiones...": "Loading reviews...",
  "Cargando usuarios...": "Loading users...",
  "Cargando vista previa...": "Loading preview...",
  Categoria: "Category",
  "Centrar mi posición": "Center my position",
  "Cerrar sin guardar": "Close without saving",
  "Chat de Shopp": "Shopp Chat",
  Coche: "Car",
  "Coloca el código dentro del recuadro": "Place the barcode inside the frame",
  "Completa tus datos para empezar a utilizar Shopp.":
    "Complete your details to start using Shopp.",
  "Comprado en tiendas": "Purchased at stores",
  "Comprobando permisos": "Checking permissions",
  "Comprobando permisos de cámara...": "Checking camera permissions...",
  "Comprobando permisos…": "Checking permissions…",
  "Comprueba tu correo": "Check your email",
  "Comunica de forma privada una posible vulneración de derechos.":
    "Privately report a possible rights violation.",
  "Comunicación privada con Shopp": "Private communication with Shopp",
  "Configuración del código de barras": "Barcode settings",
  "Consulta la ficha completa del producto": "View full product details",
  "Consulta las listas ya pagadas, revisa sus productos y accede al detalle de cada compra archivada.":
    "View completed lists, review their products and open each archived purchase.",
  "Consulta las tiendas ordenadas por distancia desde tu ubicación.":
    "View stores sorted by distance from your location.",
  "Consulta los productos comprados agrupados por categoría, subcategoría y supermercado.":
    "View purchased products grouped by category, subcategory and supermarket.",
  "Consulta productos y códigos de barras escaneados anteriormente.":
    "View previously scanned products and barcodes.",
  "Consulta tiendas y preferencias.": "View stores and preferences.",
  "Consulta tus tiendas guardadas y accede rápidamente a sus detalles.":
    "View your saved stores and quickly open their details.",
  "Consultando Convex": "Checking Convex",
  Contactar: "Contact",
  "Código de seguridad": "Security code",
  "Código de verificación": "Verification code",
  "Código leído...": "Barcode read...",
  "DATOS PRINCIPALES": "MAIN DATA",
  DESARROLLO: "DEVELOPMENT",
  Descripción: "Description",
  Destino: "Destination",
  "Detalles del room": "Room details",
  "Detalles específicos": "Specific details",
  Dirección: "Address",
  "Distancia al centro": "Distance to center",
  "Documentos adjuntos": "Attachments",
  "Editar avatar": "Edit avatar",
  "El registro global de Convex no se eliminará.":
    "The global Convex record will not be deleted.",
  "Elegir destino": "Choose destination",
  "Elige destino y revisa las plazas recientes antes de volver al chat.":
    "Choose a destination and review recent parking spots before returning to chat.",
  "Elige los formatos que puede detectar el scanner.":
    "Choose the formats the scanner can detect.",
  "Elige un alias para identificarte en Shopp.":
    "Choose an alias to identify yourself in Shopp.",
  "Elige una tienda favorita para asociarla a esta lista de compra.":
    "Choose a favorite store for this shopping list.",
  "Empezar de nuevo como buscando plaza": "Start again as looking for a spot",
  "En línea": "Online",
  Entrar: "Sign in",
  "Entrar en Shopp": "Sign in to Shopp",
  "Escanea nuevos productos o consulta el historial de códigos escaneados.":
    "Scan new products or view barcode scan history.",
  "Escáner básico": "Basic scanner",
  "Esperando la respuesta de Convex.": "Waiting for Convex response.",
  "Esta categoría no tiene subcategorías": "This category has no subcategories",
  "Esta funcionalidad está disponible únicamente para usuarios con privilegios de administrador.":
    "This feature is available only to administrators.",
  "Esta lista ya no está activa": "This list is no longer active",
  "Esta pantalla solo está disponible para administradores.":
    "This screen is available only to administrators.",
  "Estado actual": "Current status",
  "Explora tiendas, consulta tus favoritas o busca establecimientos cercanos.":
    "Explore stores, view favorites or find nearby stores.",
  "Explorar tiendas": "Explore stores",
  Fecha: "Date",
  Finalizar: "Finish",
  "Formatos admitidos": "Supported formats",
  Fuente: "Source",
  "Guarda productos escaneados.": "Save scanned products.",
  "Herramientas y funciones de Shopp": "Shopp tools and features",
  "Historial de Escaneos": "Scan History",
  "Historial de productos": "Product history",
  "Historial local": "Local history",
  "Historial por fecha": "History by date",
  Hoy: "Today",
  "Imagen del producto": "Product image",
  "Importa una imagen para guardarla localmente en este dispositivo.":
    "Import an image to save it locally on this device.",
  "Importe calculado": "Calculated amount",
  "Información de tiendas": "Store information",
  "Inicia sesión para guardar tus listas, historial, tiendas, parking y preferencias.":
    "Sign in to save your lists, history, stores, parking and preferences.",
  "Introduce el correo asociado a tu cuenta. Te enviaremos un código para crear una nueva contraseña.":
    "Enter the email associated with your account. We will send you a code to create a new password.",
  "Introduce un email válido.": "Enter a valid email address.",
  "Introducir código manualmente": "Enter code manually",
  "La contraseña debe contener:": "Password must contain:",
  "La contraseña debe incluir:": "Password must include:",
  "La contraseña se ha cambiado correctamente. Ya puedes iniciar sesión.":
    "Your password has been changed. You can now sign in.",
  "Latitud destino": "Destination latitude",
  "Latitud usuario": "User latitude",
  "Lectura más rápida y con menor consumo de batería.":
    "Faster scanning with lower battery use.",
  "Lee el código y lo devuelve al producto. No busca en internet ni guarda historial.":
    "Reads the code and returns it to the product. It does not search online or save history.",
  Limpiar: "Clear",
  "Lista sin productos": "List without products",
  "Listas sincronizadas": "Synced lists",
  "Listas, tiendas, historial, escáner y parking en una sola app.":
    "Lists, stores, history, scanner and parking in one app.",
  "Longitud destino": "Destination longitude",
  "Longitud usuario": "User longitude",
  "Mapa Parking": "Parking map",
  "Mapa de mediciones": "Measurement map",
  Marca: "Brand",
  "Marca una tienda como favorita para poder seleccionarla rápidamente.":
    "Mark a store as favorite so you can select it quickly.",
  "Marca una tienda con la estrella para acceder rápidamente a ella.":
    "Star a store for quick access.",
  Marcador: "Marker",
  "Mediciones GPS": "GPS measurements",
  "Mediciones guardadas": "Saved measurements",
  "Mensaje opcional": "Optional message",
  "Mensajes sincronizados con Convex": "Messages synced with Convex",
  "Mis listas": "My lists",
  "Modalidad de trabajo": "Work mode",
  "Modo solicitado": "Requested mode",
  "Mostrar teléfono en Parking": "Show phone number in Parking",
  "Más opciones": "More options",
  "Necesitas permitir el acceso a la cámara para escanear productos.":
    "You need to allow camera access to scan products.",
  "Necesitas permitir el acceso a la cámara para leer el código de barras del producto.":
    "You need to allow camera access to read the product barcode.",
  "No hay destinos activos en Convex.":
    "There are no active destinations in Convex.",
  "No hay historial de compras": "No purchase history",
  "No hay información de tiendas disponible.":
    "No store information is available.",
  "No hay listas archivadas": "No archived lists",
  "No hay plazas cercanas": "No nearby parking spots",
  "No hay plazas libres reveladas ahora mismo.":
    "There are no available spots reported right now.",
  "No hay productos pendientes de revisión.":
    "There are no products pending review.",
  "No hay tiendas cercanas": "No nearby stores",
  "No hay tiendas en el mapa": "No stores on the map",
  "No se encontraron tiendas": "No stores found",
  "No se encontró información detallada para este código.":
    "No detailed information was found for this code.",
  "No se ha recibido información del producto seleccionado.":
    "No information was received for the selected product.",
  "No se pudo abrir la cámara": "Could not open the camera",
  "No se pudo cargar el producto": "Could not load the product",
  "No se pudo obtener tu ubicación": "Could not get your location",
  "No tienes tiendas favoritas": "You have no favorite stores",
  "Ocultar mapa": "Hide map",
  Oferta: "Offer",
  "Oferta aplicable": "Applicable offer",
  Opcional: "Optional",
  "Organiza mejor tus compras": "Organize your shopping better",
  "Organiza tus compras, tiendas, historial y parking desde una sola app.":
    "Manage shopping, stores, history and parking from one app.",
  Origen: "Origin",
  "PRODUCTO ESCANEADO": "SCANNED PRODUCT",
  "Parking Spots": "Parking Spots",
  "Personaliza tu usuario y selecciona una room":
    "Customize your user and select a room",
  "Playlist de YouTube": "YouTube playlist",
  "Plazas cercanas": "Nearby spots",
  "Plazas libres reveladas": "Reported available spots",
  "Precio/u": "Price/unit",
  Precisión: "Accuracy",
  "Precisión de la lectura": "Scan accuracy",
  "Precisión máxima": "Maximum accuracy",
  "Precisión normal": "Normal accuracy",
  "Procesando código": "Processing code",
  "Procesando...": "Processing...",
  "Producto no disponible": "Product unavailable",
  "Producto no encontrado": "Product not found",
  "Productos enviados a revisión": "Products sent for review",
  Promoción: "Promotion",
  "Prueba a cambiar la búsqueda o revisa el filtro aplicado.":
    "Try changing the search or review the applied filter.",
  "Prueba el alta de un producto sin utilizar la cámara.":
    "Test adding a product without using the camera.",
  "Publica un estado para crear el primer mensaje.":
    "Post a status to create the first message.",
  "Pulsa para abrir y reproducir la lista completa":
    "Tap to open and play the full playlist",
  "Pulsa para cambiar": "Tap to change",
  Recentrar: "Recenter",
  Rechazar: "Reject",
  "Reenviar código": "Resend code",
  Reintentar: "Retry",
  "Repetir contraseña": "Repeat password",
  Resumen: "Summary",
  "Resumen del producto": "Product summary",
  "Revisa los permisos de ubicación para ordenar las tiendas por cercanía.":
    "Check location permissions to sort stores by proximity.",
  "Revisa también las carpetas de correo no deseado o promociones.":
    "Also check your spam or promotions folders.",
  "Revisa y valida la información aportada por los usuarios.":
    "Review and validate information submitted by users.",
  Room: "Room",
  Rooms: "Rooms",
  "Rooms rápidas": "Quick rooms",
  "Se necesita acceso a la cámara.": "Camera access is required.",
  "Se permiten enlaces http:// y https://":
    "http:// and https:// links are allowed",
  "Selecciona una categoría": "Select a category",
  "Seleccionar tienda": "Select store",
  "Sin actividad todavía": "No activity yet",
  "Sin compras registradas": "No purchases recorded",
  "Sin coordenadas disponibles": "No coordinates available",
  "Sin imagen": "No image",
  "Sin plazas registradas": "No parking spots recorded",
  "Sin tienda": "No store",
  "Sincroniza tus listas de compra.": "Sync your shopping lists.",
  "Sincronizar historial de escaneos": "Sync scan history",
  "Solo enteros para unidades (u)": "Whole numbers only for units (u)",
  Subcategoría: "Subcategory",
  "Sustituye los campos con datos externos":
    "Replace fields with external data",
  "Tamaño del avatar": "Avatar size",
  Teléfono: "Phone",
  "Tienda no encontrada": "Store not found",
  "Tiendas cercanas": "Nearby stores",
  "Tiendas favoritas": "Favorite stores",
  "Tiendas y preferencias": "Stores and preferences",
  "Tipo de producto": "Product type",
  "Todo está al día": "Everything is up to date",
  "Tomar foto": "Take photo",
  "Trabajo de campo": "Field work",
  "Trabajo de gabinete": "Office work",
  "Tu asistente de compras": "Your shopping assistant",
  "Tu lista de compras inteligente": "Your smart shopping list",
  "Tu lista de la compra inteligente": "Your smart shopping list",
  "Tus datos disponibles en todos tus dispositivos.":
    "Your data available on all your devices.",
  Unidad: "Unit",
  "Usa una imagen cuadrada para obtener mejores resultados.":
    "Use a square image for best results.",
  Usar: "Use",
  "Usar otro correo": "Use another email",
  "Usuarios conectados": "Connected users",
  "Usuarios registrados": "Registered users",
  "VISTA PREVIA": "PREVIEW",
  "Ver en mapa": "View on map",
  "Ver información del producto": "View product information",
  "Ver mapa (OpenStreetMap)": "View map (OpenStreetMap)",
  "Ver productos y códigos escaneados anteriormente":
    "View previously scanned products and barcodes",
  "Verifica tu correo": "Verify your email",
  "Verificar y continuar": "Verify and continue",
  "Volver al inicio de sesión": "Back to sign in",
  Zona: "Zone",
  "Zona de trabajo": "Work area",
  "¿Has olvidado tu contraseña?": "Forgot your password?",
  "¿No tienes cuenta?": "Don't have an account?",
  "¿Ya tienes una cuenta?": "Already have an account?",
  "Última actualización": "Last update",
  "Última lectura del móvil": "Last mobile reading",
  "‹ Volver": "‹ Back",
  "‹ Volver a la lista": "‹ Back to list",
});

// Traducciones añadidas para las pantallas de chat incorporadas después de la
// primera internacionalización. El español sigue siendo el idioma fuente.
Object.assign(EN, {
  "Chat de compras": "Shopping chat",
  "Chat prototipo": "Chat prototype",
  "Prueba el nuevo chat de compras": "Try the new shopping chat",
  "Tú ·": "You ·",
  "Usuario no autenticado": "User not signed in",
  "Debes iniciar sesión para participar en el chat de la tienda.":
    "You must sign in to take part in the store chat.",
  "Mensaje demasiado largo": "Message too long",
  "No se pudo comprobar que estás cerca de la tienda.":
    "We couldn't verify that you are near the store.",
  "No se pudo enviar": "Could not send",
  "No se pudo enviar el mensaje.": "The message could not be sent.",
  "No se pudo preparar la imagen": "Could not prepare image",
  "No se pudo seleccionar, reducir o convertir la imagen a JPEG.":
    "The image could not be selected, resized, or converted to JPEG.",
  "No se pudo subir una de las imágenes.":
    "One of the images could not be uploaded.",
  "Precio no válido": "Invalid price",
  "Introduce el precio pagado por el producto.":
    "Enter the price paid for the product.",
  "Producto comprado": "Purchased product",
  "No se pudo compartir": "Could not share",
  "No se pudo publicar el producto.": "The product could not be posted.",
  "Comprobando si estás cerca de la tienda…":
    "Checking whether you are near the store…",
  "Activa el permiso de ubicación para acceder a este chat.":
    "Enable location permission to access this chat.",
  "No se pudo obtener tu ubicación. Pulsa para intentarlo de nuevo.":
    "Your location could not be obtained. Tap to try again.",
  "El chat solo está disponible para personas situadas cerca de Carrefour Los Fresnos.":
    "The chat is only available to people near Carrefour Los Fresnos.",
  Reintentar: "Try again",
  "Cargando mensajes…": "Loading messages…",
  "Todavía no hay mensajes en esta tienda.":
    "There are no messages in this store yet.",
  "Precio pagado": "Price paid",
  Compartir: "Share",
  "Quitar imagen": "Remove image",
  "Añadir imagen": "Add image",
  "Añade un comentario…": "Add a comment…",
  Mensaje: "Message",
  "Mensaje para el chat de la tienda": "Message for the store chat",
  "Enviar mensaje": "Send message",
  "Sala abierta · #": "Open room · #",
  "Tu alias": "Your alias",
  "Conectando con Convex…": "Connecting to Convex…",
  "Todavía no hay mensajes": "There are no messages yet",
  "Abre Shopp en otro dispositivo y usa un alias diferente para probar la conversación en tiempo real.":
    "Open Shopp on another device and use a different alias to test the conversation in real time.",
  "Escribe un mensaje…": "Write a message…",
  "Pruebas abiertas · sin login obligatorio":
    "Open testing · sign-in not required",
  Tú: "You",
  tú: "you",
  "Escribe mensaje...": "Write a message...",
  "Detalles del room": "Room details",
  "Conversaciones generales del grupo.": "General group conversations.",
  "Usuarios conectados": "Connected users",
  "En línea": "Online",
  "Acciones rápidas": "Quick actions",
  "Añadir usuarios": "Add users",
  "Compartir room": "Share room",
  Notificaciones: "Notifications",
  "Salir del room": "Leave room",
  Ocultar: "Hide",
  Username: "Username",
  anonymous: "anonymous",
  general: "general",
  familia: "family",
  trabajo: "work",
  compras: "shopping",
  "Todavía no hay mensajes en esta room.":
    "There are no messages in this room yet.",
  "¿Qué está pasando en la compra?": "What is happening with the shopping?",
  "Se permiten enlaces http:// y https://":
    "http:// and https:// links are allowed",
  "No se pudo enviar el mensaje.": "The message could not be sent.",
  Post: "Post",
});

// Cobertura adicional de textos visibles incorporados en pantallas recientes.
Object.assign(EN, {
  "Correo de Shopp": "Shopp email",
  "Los archivos no se publican en el chat. Se eliminan del almacenamiento temporal después de intentar enviar el correo. Máximo: 5 archivos, 5 MB por archivo y 10 MB en total.":
    "Files are not posted in the chat. They are removed from temporary storage after attempting to send the email. Maximum: 5 files, 5 MB per file and 10 MB in total.",
  "Asunto del mensaje": "Message subject",
  "Describe los hechos con claridad. No incluyas contraseñas ni datos bancarios.":
    "Describe what happened clearly. Do not include passwords or bank details.",
  "Enviar comunicación privada a la administración de Shopp":
    "Send a private message to Shopp administration",
  "Archivo no permitido": "File not allowed",
  "No se pudieron añadir los archivos": "The files could not be added",
  "Mensaje enviado": "Message sent",
  "Vídeos de la playlist": "Playlist videos",
  "Abrir en YouTube": "Open in YouTube",
  "Cerrar reproductor": "Close player",
  "No se pudo copiar": "Could not copy",
  "Especificar tienda": "Specify store",
  "Círculo con varilla": "Circle with stem",
  Círculo: "Circle",
  "Mantén el código dentro del marco. El número se copiará automáticamente cuando sea detectado.":
    "Keep the code inside the frame. The number will be copied automatically when detected.",
  "Buscar…": "Search…",
  "Buscar producto (actual o histórico)…":
    "Search current or previous products…",
  "Pulsa “Actualizar ubicación” para mostrar tu posición.":
    "Tap “Update location” to show your position.",
  "Cerrar diálogo": "Close dialog",
  "Cerrar menú": "Close menu",
  "Productos comerciales en Europa y supermercados":
    "Retail products in Europe and supermarkets",
  "Productos pequeños con código corto": "Small products with a short code",
  "Productos de EE. UU. y Canadá": "Products from the US and Canada",
  "Versión compacta de UPC": "Compact UPC version",
  "URLs, promociones, tickets o información adicional":
    "URLs, promotions, receipts or additional information",
  "Logística, almacenes y etiquetas internas":
    "Logistics, warehouses and internal labels",
  "Respuesta generada por Google a partir del código":
    "Response generated by Google from the code",
  "Precios, tiendas y ofertas disponibles":
    "Available prices, stores and deals",
  "Búsqueda general en Google": "General Google search",
  "Búsqueda general en Bing": "General Bing search",
  "Precios, tiendas y ofertas en Bing": "Prices, stores and deals on Bing",
  "Búsqueda general con DuckDuckGo": "General DuckDuckGo search",
  "Ficha de producto en Open Food Facts": "Product details on Open Food Facts",
  "Consulta el código en Barcode Lookup": "Look up the code on Barcode Lookup",
  "URL de imagen": "Image URL",
  "URL del producto": "Product URL",
  "Nota de revisión": "Review note",
  Revisión: "Review",
  "No se pudo cambiar el rol": "The role could not be changed",
  "Guarda tus listas, consulta tus tiendas habituales, revisa compras anteriores y configura tus preferencias con una experiencia preparada para móvil, tablet y escritorio.":
    "Save your lists, view your usual stores, review previous purchases and configure your preferences on mobile, tablet and desktop.",
  "Crear cuenta": "Create account",
  "Tu contraseña": "Your password",
  "PASO 1 DE 2": "STEP 1 OF 2",
  "Crear una cuenta": "Create an account",
  "PASO 2 DE 2": "STEP 2 OF 2",
  "Código enviado a": "Code sent to",
  "Tu nombre": "Your name",
  "Número de teléfono": "Phone number",
  "Repite la contraseña": "Repeat password",
  "Hemos enviado un código de seguridad a:": "We sent a security code to:",
  "Contraseña actualizada": "Password updated",
  "Tu contraseña se ha cambiado correctamente. Ya puedes iniciar sesión con la nueva contraseña.":
    "Your password has been changed. You can now sign in with the new password.",
  "Enviar código": "Send code",
  "Guardar nueva contraseña": "Save new password",
  "Editar playlist de YouTube": "Edit YouTube playlist",
  "Seleccionar carátula": "Select cover",
  "Nombre de la playlist": "Playlist name",
  "Carátula opcional": "Optional cover",
  "LRC sincronizado · máximo 512 KB": "Synchronized LRC · 512 KB maximum",
  "Añadir imágenes": "Add images",
  "Formato no válido": "Invalid format",
  "Describe una fotografía": "Describe a photograph",
  "Escribe varias frases en inglés y recibe correcciones explicadas en español.":
    "Write several sentences in English and receive corrections explained in Spanish.",
  "URL de la fotografía": "Photograph URL",
  "Tu descripción en inglés": "Your description in English",
  Corrección: "Correction",
  "No se pudo corregir": "Could not correct the description",
  "Este producto todavía no tiene compras individuales asociadas.":
    "This product does not have any individual purchases yet.",
  "Último precio": "Latest price",
  "Precio medio": "Average price",
  "Precio mínimo": "Lowest price",
  "Precio máximo": "Highest price",
  "Cuando archives una lista de compra aparecerán aquí sus productos agrupados por categoría y subcategoría.":
    "When you archive a shopping list, its products will appear here grouped by category and subcategory.",
  "Buscar categoría, producto o supermercado...":
    "Search category, product or supermarket...",
  "Cuando archives una lista de compra aparecerá aquí.":
    "When you archive a shopping list, it will appear here.",
  "Buscar lista, supermercado o producto…":
    "Search list, supermarket or product…",
  "Nombre visible en la lista y código EAN-13":
    "Name shown in the list and EAN-13 code",
  "Nombre del producto": "Product name",
  Categorías: "Categories",
  "Clasifica el producto por categoría y subcategoría":
    "Classify the product by category and subcategory",
  "Precio y cantidad": "Price and quantity",
  "Datos principales para calcular el importe":
    "Main data used to calculate the amount",
  "Unidad de medida": "Unit of measure",
  "Cambia la unidad utilizada para calcular el precio":
    "Change the unit used to calculate the price",
  "Aplica promociones compatibles con la unidad elegida":
    "Apply promotions compatible with the selected unit",
  "Nombre vacío": "Empty name",
  "Cantidad inválida": "Invalid quantity",
  "Oferta inválida": "Invalid deal",
  "Eliminar producto": "Delete product",
  "Código vacío": "Empty code",
  "Buscar productos": "Search products",
  "Lista vacía": "Empty list",
  "Sin productos marcados": "No selected products",
  "Sin importe": "No amount",
  "Crea listas, consulta productos y accede rápidamente a las principales herramientas.":
    "Create lists, view products and quickly access the main tools.",
  "Crea tu primera lista": "Create your first list",
  "Nombre de la lista": "List name",
  "Archivar lista": "Archive list",
  "Eliminar lista": "Delete list",
  "Escanea productos y consulta el historial":
    "Scan products and view the history",
  "Comparte información": "Share information",
  "Localiza tu vehículo": "Find your vehicle",
  "Vigilancia de incendios por WebRTC": "Fire monitoring via WebRTC",
  "Comprueba la precisión": "Check accuracy",
  "Alterna entre trabajo de campo con GPS real y trabajo de gabinete con puntos seleccionados manualmente en el mapa.":
    "Switch between field work with real GPS and office work with points selected manually on the map.",
  "Herramienta administrativa. Convex comprueba el rol antes de leer, guardar o borrar mediciones.":
    "Administrative tool. Convex checks the role before reading, saving or deleting measurements.",
  "Permite centrar y guardar la posición GPS actual.":
    "Allows you to center and save the current GPS position.",
  "Más lenta y con mayor consumo; solicita la mejor lectura disponible.":
    "Slower and more power-intensive; requests the best available reading.",
  "Las cards pertenecen únicamente al destino seleccionado.":
    "Cards belong only to the selected destination.",
  "Todavía no hay lecturas en esta zona.":
    "There are no readings in this area yet.",
  "GPS desactivado en gabinete": "GPS disabled in office mode",
  "Selecciona un punto": "Select a point",
  "Punto de gabinete guardado": "Office point saved",
  "No se pudo guardar": "Could not save",
  "Borrar medición": "Delete measurement",
  "No se pudo borrar": "Could not delete",
});

Object.assign(EN, {
  "Cargando parkingSpots": "Loading parking spots",
  "La consulta no ha devuelto registros de parkingSpots dentro del radio actual.":
    "The query returned no parking spots within the current radius.",
  "Coordenadas aproximadas de la plaza.":
    "Approximate coordinates of the parking spot.",
  "Activa una o ambas casillas para centrar el mapa en usuario, destino o ajustar ambos puntos.":
    "Enable one or both boxes to center the map on the user or destination, or fit both points.",
  "Esperando la respuesta de parkingSpots.": "Waiting for parking spots.",
  "No se encontraron plazas válidas dentro del radio configurado.":
    "No valid parking spots were found within the configured radius.",
  "Comparte si estás buscando plaza, si aparcaste, si dejas una plaza libre o si abandonas la búsqueda.":
    "Share whether you are looking for a spot, have parked, are leaving a spot or have stopped searching.",
  "El permiso de ubicación está denegado. Puedes seguir usando Parking, pero no se actualizará tu posición.":
    "Location permission is denied. You can continue using Parking, but your position will not be updated.",
  "Falta configurar alias público o destino. Abre Ajustes antes de publicar.":
    "A public alias or destination is missing. Open Settings before posting.",
  "Coordenadas del usuario": "User coordinates",
  "Posición GPS actual detectada por la app.":
    "Current GPS position detected by the app.",
  "Mostrar usuario en el mapa": "Show user on map",
  "Coordenadas del destino": "Destination coordinates",
  "Destino elegido para buscar aparcamiento.":
    "Destination selected for finding parking.",
  "Mostrar destino en el mapa": "Show destination on map",
  "Mostrar plazas de aparcamiento": "Show parking spots",
  "Ejemplo: estoy en doble fila, salgo en 2 minutos...":
    "Example: I am double-parked and leaving in 2 minutes...",
  "Actividad de parking": "Parking activity",
  "Permiso de ubicación necesario": "Location permission required",
  "Cambio de estado no permitido": "Status change not allowed",
  "Ubicación necesaria": "Location required",
  "Plaza guardada": "Parking spot saved",
  "Selecciona el lugar al que vas para revisar actividad y plazas recientes.":
    "Select your destination to review recent activity and parking spots.",
  "No hay destinos activos. Ejecuta primero la carga inicial.":
    "There are no active destinations. Run the initial load first.",
  "Este alias se muestra a otros usuarios. El identificador real de Convex Auth queda oculto y solo se usa internamente.":
    "This alias is shown to other users. The real Convex Auth identifier remains hidden and is used only internally.",
  "Sin actividad": "No activity",
  "Tráfico bajo": "Low traffic",
  "Tráfico medio": "Medium traffic",
  "Tráfico alto": "Heavy traffic",
  "Esta cuenta todavía no tiene perfil. Completa un alias público para usar Parking y Chat sin mostrar tu email.":
    "This account does not have a profile yet. Add a public alias to use Parking and Chat without showing your email.",
  "Es el nombre visible para otros usuarios en Parking y Chat. No uses tu nombre real si quieres proteger tu privacidad.":
    "This is the name shown to other users in Parking and Chat. Do not use your real name if you want to protect your privacy.",
  "El teléfono es opcional. Guárdalo solo si quieres usarlo como dato de contacto en funciones de Parking.":
    "Your phone number is optional. Save it only if you want to use it as contact information in Parking features.",
  "Por defecto queda oculto. Actívalo solo si quieres que otros usuarios puedan verlo.":
    "It is hidden by default. Enable it only if you want other users to see it.",
  "Si está activado, los productos escaneados se guardan en Convex para tu cuenta. Si está desactivado, se guardan solo en este navegador o teléfono.":
    "When enabled, scanned products are saved to your Convex account. When disabled, they are saved only in this browser or phone.",
  "Permiso necesario": "Permission required",
  "No se pudo seleccionar": "Could not select",
  "No se pudo actualizar": "Could not update",
  "No se pudo eliminar": "Could not delete",
  "Teléfono demasiado largo": "Phone number too long",
  "Sincronización parcial": "Partial synchronization",
  "Estos campos cambian según el tipo de producto seleccionado.":
    "These fields change according to the selected product type.",
  "Estamos verificando si tu usuario puede editar productos escaneados.":
    "We are checking whether your account can edit scanned products.",
  "Crea detalle.jpeg de 256 px y thumbnail.jpeg de 64 px":
    "Creates a 256 px detail.jpeg and a 64 px thumbnail.jpeg",
  "JSON de la ficha de supermercado": "Supermarket product JSON",
  "Copia la respuesta de Google Modo IA, pégala aquí y aplícala para rellenar los campos.":
    "Copy the Google AI Mode response, paste it here and apply it to fill in the fields.",
  "JSON de la ficha musical": "Music product JSON",
  "JSON de la ficha del libro": "Book product JSON",
  "Producto cargado": "Product loaded",
  "Los datos se han recuperado correctamente.":
    "The data was retrieved successfully.",
  "Buscando información": "Searching for information",
  "Buscando el código de barras en la base de datos.":
    "Searching for the barcode in the database.",
  "Nuevo código registrado": "New code registered",
  "No existía información. Se ha creado un registro mí­nimo en Convex.":
    "No information existed. A minimal record was created in Convex.",
  "Información no encontrada": "Information not found",
  "El código está registrado, pero todavía no contiene datos del producto.":
    "The code is registered, but it does not contain product data yet.",
  "Importar imagen del producto": "Import product image",
  "Aplicar JSON a la ficha de supermercado":
    "Apply JSON to supermarket product",
  "Aplicar JSON a la ficha del libro": "Apply JSON to book product",
  "Marca o fabricante": "Brand or manufacturer",
  "Ej. Música clásica": "E.g. classical music",
  "Notas personales sobre el producto": "Personal notes about the product",
  "Eliminar del historial": "Delete from history",
  "Eliminar también de la base de datos": "Also delete from the database",
  "Cambia al siguiente tipo de producto": "Switch to the next product type",
  "Código no válido": "Invalid code",
  "Error de navegación": "Navigation error",
  "Producto detectado": "Product detected",
  "No se pudo iniciar la cámara": "Could not start the camera",
  "Escanear producto": "Scan product",
  "No añadir": "Do not add",
  "Escanear código": "Scan code",
  "Pegar imagen copiada": "Paste copied image",
  "Buscar producto, marca o código...": "Search product, brand or code...",
  "Corregir y aprobar productos enviados por usuarios":
    "Correct and approve products submitted by users",
  "Código de barras manual": "Manual barcode",
  "Selecciona qué formatos debe intentar leer el scanner. Para productos de supermercado, mantén activos EAN-13, EAN-8, UPC-A y UPC-E.":
    "Choose which formats the scanner should try to read. For supermarket products, keep EAN-13, EAN-8, UPC-A and UPC-E enabled.",
  "Si activas demasiados formatos, algunos scanners pueden tardar más o detectar códigos no deseados. Para supermercado, empieza con EAN-13 y UPC.":
    "If you enable too many formats, some scanners may take longer or detect unwanted codes. For supermarket products, start with EAN-13 and UPC.",
  "En web, los permisos dependen del navegador, del uso de HTTPS y de los ajustes del sitio.":
    "On the web, permissions depend on the browser, HTTPS and site settings.",
  "Si un permiso ya está concedido, Android/iOS no permiten volver a mostrar el diálogo del sistema desde la app. Para probar el flujo otra vez, revoca el permiso desde Ajustes.":
    "If a permission has already been granted, Android/iOS cannot show the system dialog again from the app. To test the flow again, revoke the permission in Settings.",
  "Elimina las listas de compra que todavía no están archivadas":
    "Delete shopping lists that have not yet been archived",
  "Elimina las listas guardadas como archivadas":
    "Delete lists saved as archived",
  "Limpia los registros generados a partir de compras anteriores":
    "Clear records generated from previous purchases",
  "Elimina productos y códigos guardados desde el scanner":
    "Delete products and codes saved from the scanner",
  "Restaura las tiendas desde los datos iniciales del proyecto":
    "Restore stores from the project's initial data",
  "Elimina todos los datos locales guardados por la aplicación":
    "Delete all local data saved by the app",
  "Permiso bloqueado": "Permission blocked",
  "Motores de productos": "Product search engines",
  "Elige el motor que se usará al buscar productos o códigos de barras.":
    "Choose the engine used to search for products or barcodes.",
  "Próximamente: horarios, notas y productos asociados":
    "Coming soon: opening hours, notes and associated products",
  "Detalle de tienda": "Store details",
  "Aquí podrás consultar información general de las tiendas: horarios, direcciones, estado, favoritos y datos relacionados con tiendas cercanas.":
    "Here you can view general store information: opening hours, addresses, status, favorites and nearby store data.",
  "La información de tiendas se obtiene de los datos locales de la aplicación. Más adelante puedes conectar esta pantalla con una ficha detallada, mapas o datos remotos.":
    "Store information comes from the app's local data. You can later connect this screen to detailed information, maps or remote data.",
  "No se encontraron tiendas con coordenadas válidas para mostrar.":
    "No stores with valid coordinates were found.",
  "Mapa de tiendas": "Store map",
  "Buscar tienda…": "Search store…",
  "Buscar tiendas cercanas o por nombre": "Search nearby stores or by name",
  "Acceso rápido a tus tiendas habituales": "Quick access to your usual stores",
  "Ordenadas por distancia": "Sorted by distance",
  "Horarios, direcciones y estado": "Opening hours, addresses and status",
  "Estamos calculando la distancia de las tiendas disponibles.":
    "We are calculating the distance to available stores.",
  "No se encontraron tiendas disponibles para mostrar.":
    "No available stores were found.",
});

Object.assign(EN, {
  "Verificación visual de incendios con cámara y alarmas en tiempo real mediante Convex.":
    "Visual fire verification with a camera and real-time alarms through Convex.",
  "Vista de cámara Web/PWA": "Web/PWA camera view",
  "Cámara local": "Local camera",
  "La cámara permanece local hasta enviar una alarma. Después se negocia una conexión WebRTC y Convex solo transporta señalización.":
    "The camera remains local until an alarm is sent. A WebRTC connection is then negotiated and Convex carries signaling only.",
  "Cámara remota en directo": "Live remote camera",
  "¿A quién avisamos?": "Who should we notify?",
  "De momento todos los avisos llegan al backend; después vincularemos cada opción con usuarios reales.":
    "For now, all alerts reach the backend; each option will later be linked to real users.",
  "Envía una captura y crea una alarma en Convex":
    "Send a snapshot and create an alarm in Convex",
  "Última captura enviada": "Latest snapshot sent",
  "Cargando alarmas...": "Loading alarms...",
  "No hay alarmas.": "There are no alarms.",
  "Ver cámara en directo": "View live camera",
  "Confirmar recepción": "Confirm receipt",
  "Estado del desarrollo": "Development status",
  "✓ Cámara Web/PWA": "✓ Web/PWA camera",
  "✓ Alarmas persistentes en Convex": "✓ Persistent alarms in Convex",
  "✓ Recepción en tiempo real para administrador":
    "✓ Real-time reception for administrators",
  "✓ Señalización WebRTC mediante Convex": "✓ WebRTC signaling through Convex",
  "✓ Vídeo P2P en directo con STUN (prototipo)":
    "✓ Live P2P video with STUN (prototype)",
  "✓ Soporte TURN configurable mediante variables de entorno":
    "✓ Configurable TURN support through environment variables",
  "Siguiente: pruebas de conectividad y servicio TURN de producción.":
    "Next: connectivity testing and a production TURN service.",
  "Fire Alarm es una ayuda de vigilancia y verificación visual. No sustituye sistemas certificados de detección de incendios ni los procedimientos oficiales de emergencia.":
    "Fire Alarm assists with monitoring and visual verification. It does not replace certified fire detection systems or official emergency procedures.",
  "Fire Alarm es una utilidad DEV disponible únicamente para administradores.":
    "Fire Alarm is a DEV utility available only to administrators.",
  "Contacto de confianza": "Trusted contact",
  "Sin oferta": "No deal",
});

const DYNAMIC_EN = [
  [
    /^¿Seguro que quieres eliminar “?(.+?)”?\?$/,
    (_, name) => `Are you sure you want to delete ${name}?`,
  ],
  [
    /^¿Quieres archivar la lista “(.+)”\?$/,
    (_, name) => `Do you want to archive the “${name}” list?`,
  ],
  [/^(\d+) productos$/, (_, count) => `${count} products`],
  [
    /^Enviar un mensaje privado a (.+) con fotos, vídeos o documentos adjuntos$/,
    (_, email) =>
      `Send a private message to ${email} with attached photos, videos or documents`,
  ],
  [/^Opción (\d+)$/, (_, number) => `Option ${number}`],
  [/^Tipo de producto: (.+)$/, (_, type) => `Product type: ${type}`],
  [
    /^Buscar producto en (.+)$/,
    (_, engine) => `Search for the product on ${engine}`,
  ],
  [
    /^El JSON corresponde al código (.+), no a (.+)\.$/,
    (_, jsonCode, code) => `The JSON belongs to code ${jsonCode}, not ${code}.`,
  ],
  [
    /^¿Deseas eliminar este escaneo\? (.+)$/,
    (_, product) => `Do you want to delete this scan? ${product}`,
  ],
  [/^Reproducir vídeo (\d+)$/, (_, number) => `Play video ${number}`],
  [
    /^Tipo de producto: (.+)\. Pulsar para cambiar a (.+)$/,
    (_, current, next) => `Product type: ${current}. Tap to switch to ${next}`,
  ],
  [
    /^Código: (.+) ¿Quieres añadir este producto al historial de escaneos\?$/,
    (_, code) =>
      `Code: ${code} Do you want to add this product to the scan history?`,
  ],
  [
    /^Puedes adjuntar como máximo (\d+) archivos\.$/,
    (_, count) => `You can attach up to ${count} files.`,
  ],
  [
    /^El código debe contener (\d+) dígitos\.$/,
    (_, count) => `The code must contain ${count} digits.`,
  ],
  [
    /^Original: (.+) Envío: (.+)$/,
    (_, original, processed) => `Original: ${original} Sent: ${processed}`,
  ],
  [
    /^El mensaje no puede superar (\d+) caracteres\.$/,
    (_, count) => `The message cannot exceed ${count} characters.`,
  ],
  [
    /^El mensaje supera el límite de (\d+) caracteres\.$/,
    (_, count) => `The message exceeds the ${count}-character limit.`,
  ],
  [
    /^Estás fuera del radio de (\d+) metros de (.+)\.$/,
    (_, radius, store) =>
      `You are outside the ${radius}-meter radius of ${store}.`,
  ],
  [
    /^La medición se ha añadido a (.+)\.$/,
    (_, destination) => `The measurement was added to ${destination}.`,
  ],
  [
    /^La coordenada manual se ha añadido a (.+)\.$/,
    (_, destination) => `The manual coordinate was added to ${destination}.`,
  ],
  [/^válida (\d+) min$/, (_, minutes) => `valid for ${minutes} min`],
  [
    /^(\d+) plaza\(s\) encontrada\(s\)$/,
    (_, count) => `${count} parking spot(s) found`,
  ],
  [
    /^(\d+) plaza\(s\) válidas visibles en el mapa\.$/,
    (_, count) => `${count} valid parking spot(s) visible on the map.`,
  ],
  [
    /^Se han subido (\d+) productos\. (\d+) no se pudieron sincronizar y se reintentará más tarde\.$/,
    (_, uploaded, failed) =>
      `${uploaded} products were uploaded. ${failed} could not be synchronized and will be retried later.`,
  ],
  [
    /^¿Quieres convertir a (.+) en administrador\?$/,
    (_, user) => `Do you want to make ${user} an administrator?`,
  ],
  [
    /^¿Quieres convertir a (.+) en usuario normal\?$/,
    (_, user) => `Do you want to make ${user} a regular user?`,
  ],
  [
    /^Estoy buscando plaza cerca de (.+)\.$/,
    (_, destination) => `I am looking for a parking spot near ${destination}.`,
  ],
  [
    /^Estoy saliendo\. Puede quedar una plaza libre cerca de (.+)\.$/,
    (_, destination) =>
      `I am leaving. A parking spot may become available near ${destination}.`,
  ],
  [
    /^Abandono la búsqueda porque no encontré aparcamiento cerca de (.+)\.$/,
    (_, destination) =>
      `I stopped searching because I could not find parking near ${destination}.`,
  ],
  [
    /^Cancelo la búsqueda iniciada por error cerca de (.+)\.$/,
    (_, destination) =>
      `I am cancelling the search started by mistake near ${destination}.`,
  ],
];

export function tr(value, language = activeLanguage) {
  if (language !== "en" || typeof value !== "string") return value;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (EN[normalized]) return EN[normalized];

  for (const [pattern, translate] of DYNAMIC_EN) {
    const match = normalized.match(pattern);
    if (match) return translate(...match);
  }

  return value;
}

function translateNode(node, language) {
  if (typeof node === "string") return tr(node, language);
  if (Array.isArray(node))
    return node.map((item) => translateNode(item, language));
  return node;
}

const I18nContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (value) => value,
  ready: false,
});

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await storage.getString(STORAGE_KEYS.LANGUAGE);
        if (mounted && (saved === "es" || saved === "en")) {
          activeLanguage = saved;
          setLanguageState(saved);
        }
      } catch (error) {
        console.warn("[i18n] Could not load language", error);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = async (nextLanguage) => {
    const normalized = nextLanguage === "en" ? "en" : "es";
    activeLanguage = normalized;
    setLanguageState(normalized);
    try {
      await storage.setString(STORAGE_KEYS.LANGUAGE, normalized);
    } catch (error) {
      console.warn("[i18n] Could not persist language", error);
    }
  };

  const value = useMemo(
    () => ({ language, setLanguage, t: (text) => tr(text, language), ready }),
    [language, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nText({ children, ...props }) {
  const { language } = useI18n();
  return <RNText {...props}>{translateNode(children, language)}</RNText>;
}

export function I18nTextInput({ placeholder, ...props }) {
  const { language } = useI18n();
  return <RNTextInput {...props} placeholder={tr(placeholder, language)} />;
}
