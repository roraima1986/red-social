// Importar modelo
const Follow = require("../models/follow")
const User = require("../models/user")

// importar servicios
const followService = require("./../services/followService")

// importar dependencia
const mongoosePaginate = require("mongoose-pagination")

const pruebaFollow = (req, res) => {
    return res.status(200).send({
        message: "Mensaje enviado desde: controllers/follow.js"
    })
}

// Accion de guardar un follow (accion de seguir)
const save = (req, res) => {
    // conseguir datos por body
    const params = req.body

    // Sacar id del usuario identificado
    const identity = req.user

    // crear objeto con modelo follow
    let userToFollow = new Follow({
        user: identity.id,
        followed: params.followed
    })

    // guardar objeto en base de datos
    userToFollow.save()
        .then((followStored) => {
            
            if(!followStored) {
                return res.status(500).send({
                    status: "error",                
                    message: "No se ha podido seguir al usuario"
                })
            }            
            
            return res.status(200).send({
                status: "success",                
                identity: req.user,
                follow: followStored
            })

        })
        .catch((error) => {
            
            if(error) {
                return res.status(500).send({
                    status: "error",                
                    message: "ERROR: No se ha podido seguir al usuario"
                })
            }

        })  

}

// Accion de borrar un follow (dejar de seguir)
const unfollow = (req, res) => {
    
    // recoger id del usuario identificado
    const userId = req.user.id

    // recoger el id del usuario que sigo y quiero dejar de seguir
    const followedId = req.params.id 

    // Find de las coincidencias y hacer remove
    Follow.deleteOne({
        "user":userId,
        "followed": followedId
    }).deleteOne()
    .then((followDelete) => {
        
        if(!followDelete) {
            return res.status(500).send({
                status: "error",                
                message: "No has dejado de seguir a nadie"
            })
        }

        return res.status(200).send({
            status: "success",    
            message: "Follow eliminado correctamente",    
        })
    })
    .catch((error) => {
        
        if(error) {
            return res.status(500).send({
                status: "error",                
                message: "ERROR 500: No has dejado de seguir a nadie"
            })
        }
    })
   
}

// Accion listado de usuarios que cualquier usuario esta siguiendo (siguiendo)
const following = (req, res) => {
    // sacar el id del usuario identificado
    let userId = req.user.id

    // comprobar si me llega el id por parametro en url
    if(req.params.id) userId = req.params.id

    // comprobar si me llega la pagina, sino la pagina 1
    let page = 1

    if(req.params.page) page = req.params.page

    // usuarios por pagina quiero mostrar
    const itemsPerPage = 5

    // Find a follow, popular datos de los usuarios y paginar con mongoose paginate
    Follow.find({user: userId})
    .populate("user followed", "-password -role -__v -email")
    .skip((page - 1) * itemsPerPage)
    .limit(itemsPerPage)
    .then(follows => {
        Publication.countDocuments({ "user": userId }).then(async(total) => {
            // sacar un array de los ids de usuarios que me siguen y los que sigo
            let followUserIds = await followService.followUserIds(req.user.id)
            
            return res.status(200).send({
                status: "success",    
                message: "listado de usuarios que estoy siguiendo",  
                follows,
                total, 
                pages: Math.ceil(total/itemsPerPage),
                user_following: followUserIds.following,
                user_follow_me: followUserIds.followers,
            });
        });
    })
    .catch(error => {
        return res.status(500).send({
            status: "error",
            message: "ERROR",
        });
    });
    
}

// Accion listado de usuarios que me siguen a cualquier otro usuario (soy seguido)
const followers = (req, res) => {
    
    // sacar el id del usuario identificado
    let userId = req.user.id

    // comprobar si me llega el id por parametro en url
    if(req.params.id) userId = req.params.id

    // comprobar si me llega la pagina, sino la pagina 1
    let page = 1

    if(req.params.page) page = req.params.page

    // usuarios por pagina quiero mostrar
    const itemsPerPage = 5

    // Find a follow, popular datos de los usuarios y paginar con mongoose paginate
    Follow.find({followed: userId})
    .populate("user", "-password -role -__v -email")
    .paginate(page, itemsPerPage)        
    .then(async(follows, total) => {
        
        let followUserIds = await followService.followUserIds(req.user.id)
        
        
        return res.status(200).send({
            status: "success",    
            message: "listado de usuarios que me siguen",  
            follows,
            total, 
            pages: Math.ceil(total/itemsPerPage),
            user_following: followUserIds.following,
            user_follow_me: followUserIds.followers,
        })

    })
    .catch((error) => {
    
        if(error) {
            return res.status(500).send({
                status: "error",                
                message: "ERROR 500"
            })
        }
    })
}

// Exportar acciones
module.exports = {
    pruebaFollow,
    save,
    unfollow,
    following,
    followers,
}