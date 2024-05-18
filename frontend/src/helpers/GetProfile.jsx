import { Global } from "./Global";

export const GetProfile = async(userId, setState) => {

    const request = await fetch(Global.url + "user/profile/" + userId, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": localStorage.getItem("token"),
      }
    });

    const data = await request.json();

    if(data.status == "success"){
      setState(data.user);
    }

    return data;

  }