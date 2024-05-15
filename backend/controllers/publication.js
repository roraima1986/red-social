// importar modulos
const fs = require("fs");
const path = require("path");

// importar modelos
const Publication = require("../models/publication");

// importar servicios
const followService = require("../services/followService");

// acciones de prueba
const pruebaPublication = (req, res) => {
    return res.status(200).send({
        message: "Mensaje enviado desde: controllers/publication.js"
    });
}

// guardar publicacion
const save = (req, res) => {

    // recoger datos del body
    const params = req.body;

    // si no me llegan dar respuesta negativa
    if(!params.text) {
        return res.status(400).send({
            status: "error",
            message: "Debes enviar el texto de la publicacion",
        })
    }

    // crear y rellenar el objeto del modelo
    let newPublication = new Publication(params);
    newPublication.user = req.user.id;

    // guardar objeto en base de datos
    newPublication.save()
    .then((publicationStored) => {        

        // devolver respuesta    
        return res.status(200).send({
            status: "success",
            message: "Publicacion guardada",
            publicationStored,
        })

    })
    .catch((error) => {
        return res.status(400).send({
            status: "error",
            message: "No se ha guardado la publicacion",
        })
    })    

}

// sacar una publicacion
const detail = (req, res) => {
    
    // sacar id de publicacion de la url
    const publicationId = req.params.id;

    // find con la condicion del id
    Publication.findById(publicationId)
    .then((publicationStored) => {        
        
        // devolver respuesta    
        return res.status(200).send({
            status: "success",
            message: "Mostrar publicacion",
            publication: publicationStored,
        })

    })
    .catch((error) => {
        return res.status(404).send({
            status: "error",
            message: "No existe la publicacion",
        })
    })  

}

// eliminar publicaciones
const remove = (req, res) => {

    //sacar id de la publicacion a eliminar
    const publicationId = req.params.id;

    // find y luego un remove
    Publication.findOneAndDelete({"user": req.user.id, "_id": publicationId})
    .then(() => {

        // devolver respuesta    
        return res.status(200).send({
            status: "success",
            message: "Publicacion eliminada",
            publication: publicationId,
        })

    })
    .catch((error) => {
        return res.status(500).send({
            status: "error",
            message: "No se ha eliminado la publicaion",
        })
    })
    
    

}

// listar publicaciones de un usuario
const user = (req, res) => {

    // sacar el id de usuario
    const userId = req.params.id;

    // controlar la pagina
    let page = 1;

    if(req.params.page) page = req.params.page;

    const itemsPerPage = 5;
    const options = {
        page, 
        limit: itemsPerPage, 
        sort: { created_at: -1 }, 
        populate: {path: 'user', select: '-password -role -__v -email'}
    }

    // Find, populate, ordenar, paginar
    Publication.paginate({"user": userId}, options)
    .then((result) => {

        const {docs: publications, totalDocs: total} = result;

        if(publications.length <= 0) {
            return res.status(404).send({
                status: "error",
                message: "No hay publicaciones para mostrar",
            })    
        }

        // devolver respuesta    
        return res.status(200).send({
            status: "success",
            message: "Publicaciones del perfil de un usuario",
            publications,
            page,
            total,
            pages: result.totalPages,
        })

    })
    .catch((error) => {
        
        return res.status(404).send({
            status: "error",
            message: "No hay publicaciones para mostrar",
        })

    })  
}

// subir ficheros
const upload = (req, res) => {

    // sacar publication id
    const publicationId = req.params.id;
    
    // recoger el fichero de imagen y comprobar que existe
    if(!req.file) {
        return res.status(404).send({
            sttaus: "error",
            message: "Peticion no incluye la imagen",
        })
    }

    // conseguir el nombre del archivo
    let image = req.file.originalname;

    // sacar la extension del archivo
    const imageSplit = image.split("\.");
    const extension = imageSplit[1];

    // comprobar extension
    if(extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif") {

        // borrar archivo subido
        const filePath = req.file.path;
        const fileDeleted = fs.unlinkSync(filePath);
        
        // devolver respuesta negativa
        return res.status(400).send({
            status: "error",
            message: "Extension del fichero invalida"
        })

    }   

    // si es correcto, guardar imagen en base de datos
    Publication.findByIdAndUpdate({"user": req.user.id, "_id":publicationId}, {file: req.file.filename}, {new: true})
    .then((publicationUpdated) => {

        return res.status(200).send({
            status: "success",            
            publication: publicationUpdated,
            file: req.file,
        })

    })
    .catch((error) => {
        // devolver respuesta negativa
        return res.status(500).send({
            status: "error",
            message: "Error en la subida del avatar"
        })
    })

}

// devolver archivos multimedia imagenes
const media = (req, res) => {

    // sacar el parametro de la url
    const file = req.params.file;

    // montar el path real de la imagen
    const filePath = "./uploads/publications/"+file;

    // comprobar que existe
    fs.stat(filePath, (error, exits) => {
        
        if(!exits) {
            return res.status(404).send({
                status: "error",            
                message: "No existe la imagen",
            })
        }

        // devolver un file
        return res.sendFile(path.resolve(filePath));
    })

}

// listar todas las publicaiones (FEED)
const feed = async(req, res) => {

    // sacar la pagina actual
    let page = 1;

    if(req.params.page) {
        page = req.params.page;
    }

    // establecer numero de elementos por pagina
    let itemsPerPage = 5;
    const options = {
        page, 
        limit: itemsPerPage, 
        sort: { created_at: -1 }, 
        populate: {path: 'user', select: '-password -role -__v -email'}
    }

    // sacar un array de identificadores de usuarios que yo sigo como usuario logueado
    try {
        
        const myFollows = await followService.followUserIds(req.user.id);

        // Find a publicaciones in, ordenar, popular, paginar
        Publication.paginate({user: myFollows.following}, options)
        .then((result) => {
            
            const {docs: publications, totalDocs: total} = result;

            return res.status(200).send({
                status: "success",
                message: "Feed de publicaciones",
                following: myFollows.following,
                publications,
                page,
                total,
                pages: result.totalPages,
            })

        })
        .catch((error) => {
            return res.status(500).send({
                status: "error",
                message: "No hay publicaciones para mostrar",
            })
        })

    } catch(error) {
        return res.status(500).send({
            status: "error",
            message: "No se han listado las publicaciones del feed",
        })
    }

}

// exportar acciones
module.exports = {
    pruebaPublication,
    save,
    detail,
    remove,
    user,
    upload,
    media,
    feed,
}