// importar dependencia
const mongoosePaginate = require("mongoose-pagination")
const fs = require("fs")
const path = require("path")
// importar modelo
const Publication = require("./../models/publication")
// importar servicios
const followService = require("./../services/followService")


// Acciones de prueba
const pruebaPublication = (req, res) => {
    return res.status(200).send({
        message: "Mensaje enviado desde: controllers/publication.js"
    })
}

// Guardar publicacion
const save = (req, res) => {
    // recoger datos del body
    const params = req.body

    // si no me llegan dar respuesta negativa
    if(!params.text) {
        return res.status(400).send({
            status: "error",
            message: "Debes enviar el texto de la publicacion",
        })
    }

    // crear y rellenar el objeto del modelo
    let newPublication = new Publication(params)
    newPublication.user = req.user.id

    // guardar objeto en base de datos
    newPublication.save()
    .then((publicationStored) => {
        
        if(!publicationStored) {
            return res.status(400).send({
                status: "error",
                message: "No se ha guardado la publicacion",
            })
        }

        return res.status(200).send({
            status: "success",
            message: "Publicacion guardada",
            publicationStored,
        })
    })
    .catch((error) => {
        if(error) {
            return res.status(400).send({
                status: "error",
                message: "ERROR",
            })
        }
    })        
    
}

// sacar una publicacion
const detail = (req, res) => {
    
    // Sacar id de publicacion de la url
    const publicationId = req.params.id

    // Find con la condicion del id
    Publication.findById(publicationId)
    .then(publicationStored => {

        if(!publicationStored) {
            return res.status(400).send({
                status: "error",
                message: "No existe la publicacion",
            })
        }
        
        // devolver la respuesta    
        return res.status(200).send({
            status: "success",
            message: "Mostrar una publicacion",
            publication: publicationStored,
        })

    })
    .catch(error => {
        if(error) {
            return res.status(400).send({
                status: "error",
                message: "ERROR",
            })
        }
    })

    
}

// eliminar publicaciones
const remove = (req, res) => {
    // sacar el id de la publicacion a eliminar
    const publicationId = req.params.id

    // find y luego remover
    Publication.findOneAndDelete({"user":req.user.id, "_id": publicationId})
    .then(() => {

        // devolver la respuesta    
        return res.status(200).send({
            status: "success",
            message: "Eliminar publicacion",    
            publication: publicationId,    
        })

    })
    .catch(error => {
        if(error) {
            return res.status(500).send({
                status: "error",
                message: "ERROR",
            })
        }
    })
    
    
}

// listar todas las publicaciones
const user = (req, res) => {
    // sacar el id de usuario
    const userId = req.params.id

    // controlar la pagina
    let page = 1

    if(req.params.page) page = req.params.page

    const itemsPerPage = 5

    // Find, populate, ordenar, paginar

    Publication.find({"user":userId})
    .sort("-create_at")
    .populate("user", "-password -__v -role -email")     
    .skip((page - 1) * itemsPerPage)
    .limit(itemsPerPage)
    .then(publications => {
        Publication.countDocuments({ "user": userId }).then(total => {
            
            if(publications.length <= 0){
                return res.status(404).send({
                    status: "error",
                    message: "No hay publicaciones",
                });
            }
            
            return res.status(200).send({
                status: "success",
                message: "Publicacion del perfil de un usuario",
                page,
                total,
                pages: Math.ceil(total / itemsPerPage),
                publications,
            });            
        });
    })
    .catch(error => {
        return res.status(500).send({
            status: "error",
            message: "No hay publicaciones para mostrar",
        });
    });
    
}

// subir ficheros
const upload = (req, res) => {
    // sacar publication id
    const publicationId = req.params.id
    
    // recoger el fichero de imagen y comprobar que existe
    if(!req.file) {
        return res.status(404).send({
            status: 'error',
            message: 'La peticion no incluye la imagen',
        })
    }

    // Conseguir el nombre del archivo
    let image = req.file.originalname;

    // sacar la existencia del archivo
    const imageSplit = image.split("\.");
    const extension = imageSplit[1];


    // comprobar extension
    if(extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif") {

        // Borrar archivo subido
        const filePath = req.file.filePath
        const fileDeleted = fs.unlinkSync(filePath)

        // Devolver respuesta negativa
        return res.status(400).send({
            status: "error",
            message: "Extension del fichero invalida"
        })
    }    

    // SI si es correcto, guardar imagen en base de datos
    Publication.findByIdAndUpdate({"user": req.user.id, "_id": publicationId}, {file: req.file.filename}, {new:true})
    .then((publicationUpdated) => {

        if(!publicationUpdated) {
            return res.status(500).send({
                status: "error",
                mesagge: "Error en la subida del avatar"
            })
        }
        
        // Devolver respuesta    
        return res.status(200).send({
            status:"success",                  
            publication: publicationUpdated,
            //file: req.file,   
        })   

    })
    .catch((error) => {
        
        return res.status(500).send({
            status: "error",
            mesagge: "Error"
        })        

    })

    
}

// devolver archivos multimedia
const media = (req, res) => {
    // sacar el parametro de la url
    const file = req.params.file

    // montar el path real de la imagen
    const filePath = "./uploads/publications/"+file

    // comprobar que existe
    fs.stat(filePath, (error, exists) => {
        if(!exists) {
            return res.status(404).send({
                status: "error", 
                message: "No existe la imagen",
            })
        }

        // devolver un file    
        return res.sendFile(path.resolve(filePath))
    })
    
}

// listar publicaciones de un usuario (FEED)
const feed = async (req, res) => {
    // sacar la pagina actual
    const page = 1

    if(req.params.page) page = req.params.page

    // establecer numero de elementos por pagina
    let itemsPerPage = 5

    // sacar un array de identificadores de usuarios que yo sigo como usuario logueado
    try {

        const myFollows = await followService.followUserIds(req.user.id)

        // Find a publicaciones in, ordenar, poular, paginar      
        const publications = await Publication.find({user: myFollows.following})
        .populate("user", "-password -role -__v -email")
        .sort("-create_at")
        .skip((page - 1) * itemsPerPage)
        .limit(itemsPerPage)
        .then(publications => {
            Publication.countDocuments({"user": myFollows.following}).then(total => {
                
                if(publications.length <= 0){
                    return res.status(404).send({
                        status: "error",
                        message: "No hay publicaciones",
                    });
                }
                
                return res.status(200).send({
                    status: "success",
                    message: "FEED de publicaciones",    
                    following: myFollows.following,  
                    page,
                    total, 
                    pages: Math.ceil(total/itemsPerPage),
                    publications,
                });       
            });
        })
        

        

    } catch(error) {
        return res.status(500).send({
            status: "error", 
            message: "No se han listado las publicaciones del feed",
        })
    }
    
    
}

// Exportar acciones
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