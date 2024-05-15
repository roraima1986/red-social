// importar modelo
const Follow = require("../models/follow");
const User = require("../models/user");

// importar servicio
const followService = require("../services/followService");

// acciones de prueba
const pruebaFollow = (req, res) => {
    return res.status(200).send({
        message: "Mensaje enviado desde: controllers/follow.js"
    });
}

// accion de guardar un follow (accion de seguir)
const save = (req, res) => {

    // conseguir datos por body
    const params = req.body;

    // sacar id del usuario identificado
    const identity = req.user;

    // crear objeto con modelo follow
    let userToFollow = new Follow({
        user: identity.id,
        followed: params.followed,
    });

    // guardar objeto en base de datos
    userToFollow.save()
    .then((followStored) => {        
        
        return res.status(200).send({
            status: "success",
            identity: req.user,
            follow: followStored,
        })
    })
    .catch((error) => {
        return res.status(500).send({
            status: "error",
            message: "No se ha podido seguir al usuario"
        })
    })
    
    

}

// accion de borrar un follow (accion de dejar seguir)
const unfollow = (req, res) => {

    // recoger el id del usuario identificado
    const userId = req.user.id;

    // recoger el id del usuario que sigo y quiero dejar de seguir
    const followedId = req.params.id;

    // find de las coincidencias y hacer remove
    Follow.findOneAndDelete({
        "user": userId,
        "followed": followedId
    })
    .then((followDeleted) => {
        
        return res.status(200).send({
            status: "success",
            message: "Follow eliminado correctamente",
        })

    })
    .catch((error) => {
        return res.status(500).send({
            status: "error",
            message: "No has dejado de seguir a nadie"
        })
    })
    
    

}

// accion listado de usuarios que cualquier usuario esta siguiendo (siguiendo)
const following = (req, res) => {
    
    // sacar el id del usuario identificado
    let userId = req.user.id;

    // comprobar si me llega el id por parametro en url
    if(req.params.id) userId = req.params.id;

    // comprobar si me llega la pagina, sino la pagina 1
    let page = 1;

    if(req.params.page) page = req.params.page;

    // usuarios por pagina quiero mostrar
    const itemsPerPage = 5;

    // Find a follow, popular datos de los usuarios y paginar con mongoose paginate
    Follow    
    .paginate({user: userId}, {page, limit: itemsPerPage, populate: {path: 'user followed', select: '-password -role -__v -email'}})
    .then(async(result) => {
        
        const {docs: follows, totalDocs: total} = result;

        // listado de usuarios de Roraima, y soy Luisa
        // sacar un array de ids de los usuarios que me siguen y los que sigo como Luisa
        let followUserIds = await followService.followUserIds(userId);
        
        return res.status(200).send({
            status: "success",
            message: "Listado de usuarios que estoy siguiendo",
            follows,
            total,
            pages: result.totalPages,
            user_following: followUserIds.following,
            user_follow_me: followUserIds.followers,
        })

    })
    .catch((error) => {
        return res.status(500).send({
            status: "error",
            message: "Error en el servidor",
        })
    })    

}

// accion listado de usuarios que siguen a cualquier otro usuario (soy seguido)
const followers = (req, res) => {
    
    // sacar el id del usuario identificado
    let userId = req.user.id;

    // comprobar si me llega el id por parametro en url
    if(req.params.id) userId = req.params.id;

    // comprobar si me llega la pagina, sino la pagina 1
    let page = 1;

    if(req.params.page) page = req.params.page;

    // usuarios por pagina quiero mostrar
    const itemsPerPage = 5;
    
    Follow    
    .paginate({followed: userId}, {page, limit: itemsPerPage, populate: {path: 'user', select: '-password -role -__v -email'}})
    .then(async(result) => {
        
        const {docs: follows, totalDocs: total} = result;
        
        let followUserIds = await followService.followUserIds(userId);
        
        return res.status(200).send({
            status: "success",
            message: "Listado de usuarios que me siguen",
            follows,
            total,
            pages: result.totalPages,
            user_following: followUserIds.following,
            user_follow_me: followUserIds.followers,
        })

    })
    .catch((error) => {
        return res.status(500).send({
            status: "error",
            message: "Error en el servidor",
        })
    })

}

// exportar acciones
module.exports = {
    pruebaFollow,
    save,
    unfollow,
    following,
    followers,
}