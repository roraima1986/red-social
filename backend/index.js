// importar dependencias
const connection = require("./database/connection");
const express = require("express");
const cors = require("cors");

// mensaje de  bienvenida
console.log("API NODE para red social arrancada");

// conexion a base de datos
connection();

// crear servidor node
const app = express();
const puerto = 3900;

// configurar cors
app.use(cors());

// convertir los datos del body a objetos js
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// cargar conf rutas
const userRoutes = require("./routes/user");
const publicationRoutes = require("./routes/publication");
const followRoutes = require("./routes/follow");

app.use("/api/user", userRoutes);
app.use("/api/publication", publicationRoutes);
app.use("/api/follow", followRoutes);

// ruta de prueba
app.get("/ruta-prueba", (req, res) => {
    return res.status(200).json(
        {
            "id": 1,
            "nombre": "Victor",
            "web": "victorroblesweb.es",
        }
    )
});

// poner servidor a escuchar peticiones http
app.listen(puerto, () => {
    console.log("Servidor de Node corriendo en el puerto:", puerto)
});