// Importar dependencias y modulos
const bcrypt = require("bcryptjs")
const mongoosePagination = require("mongoose-pagination")
const fs = require("fs")
const path = require("path")

// Importar modelos
const User = require("../models/user")
const Follow = require("./../models/follow")
const Publication = require("./../models/publication")


// Importar servicios
const jwt = require("../services/jwt")
const followService = require("./../services/followService")

const { param } = require("../routes/user")

// Registro de usuarios
const register = (req, res) => {
    // Recoger datos de la peticion
    let params = req.body;    

    // Comprobar que me llegan bien (+ validacion)
    if(!params.name || !params.email || !params.password || !params.nick) {       

        return res.status(400).json({
            status: "error",
            message: "Faltan datos por enviar",            
        })
    } 
    
    // Control usuarios duplicados
    User.find({
        $or: [
            { email: params.email.toLowerCase() },
            { nick: params.nick.toLowerCase()},
        ]
    }).then(async(users) => {

        // Si existe un usuario con el mismo nick o email
        if(users && users.length >= 1) {
            return res.status(200).send({
                status: 'success',
                message: 'El usuario ya existe',
            })
        }

        // cifrar la contraseña
        let pwd = await bcrypt.hash(params.password, 10)
        params.password = pwd

        // Crear objeto de usuario
        let userToSave = new User(params)

        // guardar usuario bd
        userToSave.save().then((userStored) => {
            // Devolver el resultado
            return res.status(200).json({
                status: "Success",
                message: "Usuario registrado correctamente",
                user: userStored,
            })
        }).catch((error) => {
            return res.status(500).json({status: "error", message: "Error al guardar el usuario"})
        })

    }).catch(error => {
        // si llega un error
        if(error) {
            return res.status(500).json({
                status: 'error',
                message: 'Error en la consulta de usuarios',
            })
        }
    })

    
}

const login = (req, res) => {
    
    // Recoger parametros body
    let params = req.body

    if(!params.email || !params.password) {
        return res.status(400).send({
            status:"error",
            message: "Faltan datos por enviar",
        })
    }

    // Buscar en la base de datos si existe
    User.findOne({email: params.email})
        //.select({"password":0})
        .then((user) => {
            // Comprobar su contraseña
            const pwd = bcrypt.compareSync(params.password, user.password)

            if(!pwd) {
                return res.status(400).send({
                    status: "error",
                    message: "No te has identificado correctamente",
                })
            }

            // Conseguir el Token
            const token = jwt.createToken(user)            

            // Devolver Datos del usuario
            
            return res.status(200).send({
                status: "success",
                message: "Te has identificado correctamente",
                user: {
                    id: user._id,
                    name: user.name,
                    nick: user.nick,                    
                },
                token
            });
        })
        .catch((error) => {
            if(error || !user) return res.status(404).send({
                status:"error", 
                message: "No existe el usuario",
            })
        })
    
}

const profile = (req, res) => {
    // Recibir el parametro del id de usuario por la url
    const id = req.params.id

    // Consulta para sacar los datos del usuario  
    User.findById(id)
        .select({password:0, role:0})
        .then(async(userProfile) => {

            if(!userProfile) {
                return res.status(404).send({
                    status:"error",
                    message: "El usuario no existe",
                })
            }

            // info de seguimiento
            const followInfo = await followService.followThisUser(req.user.id, id)

            // devolver el resultado            
            return res.status(200).send({
                status: "success",
                user: userProfile,
                following: followInfo.following,
                follower: followInfo.follower,
            })

        })
        .catch((error) => {
            if(error) {
                return res.status(404).send({
                    status:"error",
                    message: "Hay un error",
                })
            }
        })
    
}

const list = (req, res) => {
    
    // controlar en que pagina estamos
    let page = 1

    if(req.params.page) {
        page = req.params.page
    }
    page = parseInt(page)

    // Consulta con mongoose paginate
    let itemsPerPage = 5

    User.find().select("-password -email -role -__v").sort('_id').paginate(page, itemsPerPage)
    .then(async(users, total) =>{
        
        if(!users) {
            return res.status(404).send({
                status:"error",
                message: "No hay usuarios disponibles",
            })
        }

        // sacar un array de los ids de usuarios que me siguen y los que sigo
        let followUserIds = await followService.followUserIds(req.user.id)
        
        // devolver el resultado (posteriormente info follow)
        return res.status(200).send({
            status: "success",                
            users,
            page,
            itemsPerPage,
            total,
            pages: Math.ceil(total/itemsPerPage),
            user_following: followUserIds.following,
            user_follow_me: followUserIds.followers,
        })

    })
    .catch((error) => {
        
        if(error) {
            return res.status(500).send({
                status:"error",
                message: "Error en la consulta",
                error
            })
        }

    })    
}

const update = (req, res) => {
    
    // recoger info del usuario a actualizar
    let userIdentity = req.user
    let userToUpdate = req.body

    // Eliminar campos sobrantes
    delete userToUpdate.iat
    delete userToUpdate.exp
    delete userToUpdate.role
    delete userToUpdate.image

    // comprobar si el usuario ya existe
    User.find({
        $or: [
            { email: userToUpdate.email.toLowerCase() },
            { nick: userToUpdate.nick.toLowerCase()},
        ]
    })
    .then(async(users) => {
        
        let userIsset = false

        users.forEach(user => {
            if(user && user._id != userIdentity.id) userIsset = true
        });
        
        if(userIsset) {
            return res.status(200).send({
                status: "success",
                message: "El usuario ya existe"
            })
        }

        // cifrar la contraseña   
        if(userToUpdate.password) {
            let pwd = await bcrypt.hash(userToUpdate.password, 10)
            userToUpdate.password = pwd
        } else {
            delete userToUpdate.password
        }

        // buscar y actualizar  
        try {
            let userUpdated = await User.findByIdAndUpdate({_id: userIdentity.id}, userToUpdate, {new:true})
        
            if(!userUpdated) {
                return res.status(400).send({
                    status:"error",
                    message: "Error al actualizar usuario",
                })
            }

            // devolver respuesta
            return res.status(200).send({
                status:"success",
                message: "Metodo de actualizar usuario",
                user: userUpdated
            })   
        } catch(error) {
            return res.status(500).json({
                status: 'error',
                message: 'Error al actuaizar',
            })
        }
        
        

    })
    .catch((error) => {
        // si llega un error
        if(error) {
            return res.status(500).json({
                status: 'error',
                message: 'Error en la consulta de usuarios',
            })
        }
    })

}

const upload = (req, res) => {
    
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
    User.findByIdAndUpdate({_id: req.user.id}, {image: req.file.filename}, {new:true})
        .then((userUpdated) => {

            if(!userUpdated) {
                return res.status(500).send({
                    status: "error",
                    mesagge: "Error en la subida del avatar"
                })
            }
            
            // Devolver respuesta    
            return res.status(200).send({
                status:"success",                  
                user: userUpdated,
                file: req.file,   
            })   

        })
        .catch((error) => {

            if(error) {
                return res.status(500).send({
                    status: "error",
                    mesagge: "Error"
                })
            }

        })

    
}

const avatar = (req, res) => {
    // sacar el parametro de la url
    const file = req.params.file

    // montar el path real de la imagen
    const filePath = "./uploads/avatars/"+file

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

const counters = async (req, res) => {
    let userId = req.user.id

    if(req.params.id) {
        userId = req.params.id
    }

    try {

        const following = await Follow.count({"user": userId})

        const followed = await Follow.count({"followed": userId})

        const publications = await Publication.count( {"user":userId } )

        return res.status(200).send({
            userId,
            following: following,
            followed: followed,
            publications: publications,
        })

    } catch (error) {
        return res.status(500).send({
            status: "error", 
            message: "Error en los contadores",
            error,
        })
    }
}

// Exportar acciones
module.exports = {    
    register,
    login,
    profile,
    list,
    update,
    upload,
    avatar,
    counters,
}