//importar dependencias y modulos
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

// importar modelos
const User = require("../models/user");
const Follow = require("../models/follow");
const Publication = require("../models/publication");

// importar servicios
const jwt = require("../services/jwt");
const followService = require("../services/followService");
const validate = require("../helpers/validate");

// acciones de prueba
const pruebaUser = (req, res) => {
    return res.status(200).send({
        message: "Mensaje enviado desde: controllers/user.js",
        usuario: req.user,
    });
}

// Registro de usuarios
const register = (req, res) => {
    // recoger datos de la peticion
    let params = req.body;

    // comprobar que me llegan bien (+ validacion)
    if(!params.name || !params.email || !params.password || !params.nick) {
        return res.status(400).json({
            status: "error",
            message: "Faltan datos por enviar",
        })
    }  
    
    // Validacion avanzada
    try {
        validate(params);
    } catch(error) {
        return res.status(400).json({
            status: "error",
            message: "Validacion no superada",
        })
    }
    

    // control usuarios duplicados
    User.find({ $or: [
        {email: params.email.toLowerCase()},
        {nick: params.nick.toLowerCase()},
    ]})
    .exec()
    .then(async(users) => {       

        if(users && users.length >= 1) {            
            return res.status(200).send({
                status: "success",
                message: "El usuario ya existe"
            })
        } 

        

        // cifrar la contraseña
        let pwd = await bcrypt.hash(params.password, 10);
        params.password = pwd;

        // crear objeto de usuario
        let userToSave = new User(params);

        // guardar usuario en la base de datos
        userToSave.save()
        .then((userStored) => {
            
            // devolver resultado    
            return res.status(200).json({
                status: "success",
                message: "Usuario registrado correctamente",
                user: userStored,
            })
        
            
        })
        .catch((error) => {
            return res.status(400).json({
                status: "error",
                message: "Error al guardar los datos del usuario",
            })
        });       


    })
    .catch((error) => {
        return res.status(400).json({
            status: "error",
            message: "Error en la consulta de usuarios",
        })
    })

   
}

const login = (req, res) => {

    // recoger parametros body
    let params = req.body;

    if(!params.email || !params.password) {
        return res.status(400).send({
            status: "error",
            message: "Faltan datos por enviar",
        })
    }

    // buscar en la base de datos si existe
    User.findOne({email: params.email})
    //.select({"password": 0})
    .exec()
    .then((user) => {

        // comprobar su contraseña
        const pwd = bcrypt.compareSync(params.password, user.password)

        if(!pwd) {
            return res.status(400).json({
                status: "error",
                message: "No te has identificado correctamente",
            })
        }

        // conseguir token
        const token = jwt.createToken(user);       

        // devolver datos del usuario
        
        return res.status(200).send({
            status: "success",
            message: "Te has identificado correctamente",
            user: {
                id: user._id,
                name: user.name,
                nick: user.nick,                
            },
            token,
        })

    })
    .catch((error) => {
        return res.status(404).json({
            status: "error",
            message: "No existe el usuario",
        })
    })

    

}

const profile = (req, res) => {

    // recibir el parametro del id de usuario por la url
    const id = req.params.id;

    // consulta para sacar los datos del usuario
    User.findById(id)
    .select({password: 0, role: 0})
    .exec()
    .then(async(userProfile) => {
        
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
        return res.status(404).send({
            status: "error",
            message: "El usuario no existe o hay un error"
        })
    })


    

}

const list = (req, res) => {
    
    // controlar en que pagina estamos
    let page = 1;

    if(req.params.page) {
        page = req.params.page;
    }

    page = parseInt(page);

    // consulta con mongoose paginate
    let itemsPerPage = 5;

    User
    .paginate({}, {page, limit: itemsPerPage, select: '-password -role -__v -email'})
    .then(async(result) => {
        
        const {docs: users, totalDocs: total} = result;
        
        // sacar un array de ids de los usuarios que me siguen y los que sigo como Luisa
        let followUserIds = await followService.followUserIds(req.user.id);
        
        // devolver el resultado (posteriormente info follow)    
        return res.status(200).send({
            status: "success",
            users,
            page,
            itemsPerPage,
            total,
            pages: result.totalPages,
            user_following: followUserIds.following,
            user_follow_me: followUserIds.followers,
        })

    })
    .catch((error) => {
        return res.status(404).send({
            status: "error",
            message: "No hay usuarios disponibles",
            error,
        })
    })

   
}

const update = (req, res) => {

    // recoger info del usuario a actualizar
    let userIdentity = req.user;
    let userToUpdate = req.body;

    // eliminar campos sobrantes
    delete userToUpdate.iat;
    delete userToUpdate.exp;
    delete userToUpdate.role;
    delete userToUpdate.image;

    // comprobar si el usuario ya existe
    User.find({ $or: [
        {email: userIdentity.email.toLowerCase()},
        {nick: userIdentity.nick.toLowerCase()},
    ]})
    .exec()
    .then(async(users) => {
        
        let userIsset = false;
        users.forEach(user => {
            if(user && user._id != userIdentity.id) userIsset = true;
        });

        if(userIsset) {            
            return res.status(200).send({
                status: "success",
                message: "El usuario ya existe"
            })
        }

        // cifrar la contraseña
        if(userToUpdate.password) {
            let pwd = await bcrypt.hash(userToUpdate.password, 10);
            userToUpdate.password = pwd;
        } else {
            delete userToUpdate.password;
        }

        // buscar y actualizar  
        try {
            
            let userUpdated = await User.findByIdAndUpdate({_id: userIdentity.id}, userToUpdate, {new: true});

            if(!userUpdated) {
                return res.status(400).json({
                    status: "error",
                    message: "Error al actualizar usuarios",
                })
            }

            // devolver respuesta
            return res.status(200).send({
                status: "success",
                message: "Método de actualizar usuario",
                user: userUpdated,
            })    

        } catch (error) {
            return res.status(500).json({
                status: "error",
                message: "Error en el servidor",
            })
        }

    })
    .catch((error) => {        
        return res.status(400).json({
            status: "error",
            message: "Error en la consulta de usuarios",
        })
    })    

}

const upload = (req, res) => {

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
    User.findByIdAndUpdate({_id: req.user.id}, {image: req.file.filename}, {new: true})
    .then((userUpdated) => {

        return res.status(200).send({
            status: "success",            
            user: userUpdated,
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

const avatar = (req, res) => {

    // sacar el parametro de la url
    const file = req.params.file;

    // montar el path real de la imagen
    const filePath = "./uploads/avatars/"+file;

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

const counters = async(req, res) => {

    let userId = req.user.id;

    if(req.params.id){
        userId = req.params.id;
    }

    try{

        const following = await Follow.countDocuments({"user": userId});

        const followed = await Follow.countDocuments({"followed": userId});

        const publications = await Publication.countDocuments({"user": userId});

        return res.status(200).send({
            userId,
            following: following,
            followed: followed,
            publications: publications,
        })

    } catch(error){        
        return res.status(500).send({
            status: "error",
            message: "Error en los contadores",
        })
    }

}

// exportar acciones
module.exports = {
    pruebaUser,
    register,
    login,
    profile,
    list,
    update,
    upload,
    avatar,
    counters,
}