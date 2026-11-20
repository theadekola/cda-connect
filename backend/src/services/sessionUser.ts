export function sessionUser(row:{
 Id:string;
 FirstName:string;
 LastName:string;
 ProfileImage?:string|null;
 IsSuperAdmin?:boolean;
 IsProtectedAccount?:boolean;
}){
 return {
  Id:row.Id,
  FirstName:row.FirstName,
  LastName:row.LastName,
  ProfileImage:row.ProfileImage??null,
  IsSuperAdmin:Boolean(row.IsSuperAdmin),
  IsProtectedAccount:Boolean(row.IsProtectedAccount)
 };
}
