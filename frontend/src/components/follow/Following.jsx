import { useEffect, useState } from "react"
import { Global } from "../../helpers/Global"
import { UserList } from "../user/UserList"
import { useParams } from "react-router-dom";
import { GetProfile } from "../../helpers/GetProfile";

export const Following = () => {

  
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState({});

  const params = useParams();
  
  useEffect(() => {
    getUsers(1);
    GetProfile(params.userId, setUserProfile);
  }, [])
  
  const getUsers = async(nextPage = 1) => {
    
    // efecto de carga
    setLoading(true);

    // sacar userId de la url
    const userId = params.userId;
    
    // peticion para sacar usuarios
    const request = await fetch(Global.url + "follow/following/" +userId + "/" + nextPage, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": localStorage.getItem("token"),
      }
    });

    const data = await request.json();     
       
    // recorrer y limpiar follows para quedarme con followed
    let cleanUsers = [];
    data.follows.forEach(follow => {
        cleanUsers = [...cleanUsers, follow.followed]
    });

    data.users = cleanUsers;

    //  crear un estado para poder listarlos
    if(data.users && data.status == "success"){
      
      let newUsers = data.users;
      
      if(users.length >= 1) {
        newUsers = [...users, ...data.users];
      }
      
      setUsers(newUsers);  
      setFollowing(data.user_following);
      setLoading(false);    

      // paginacion
      if(users.length >= (data.total - data.users.length)){
        setMore(false);
      }
    }   

  }
  
  return (
    <>
      <header className="content__header">
        <h1 className="content__title">Usuarios que sigue {userProfile.name} {userProfile.surname}</h1>
      </header>

      <UserList users={users} 
                getUsers={getUsers} 
                following={following}
                setFollowing={setFollowing}
                page={page}
                setPage={setPage}
                more={more}
                loading={loading}
      />

      
    </>
  )
}
