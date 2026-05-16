import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore"

async function checkIfExists(db, path, field, value) {
    // onSnapshot(query(collection(db, path)), (snapshot) => {
    //     if(!snapshot.docs.length === 0) return false;
    //     snapshot.docs.forEach(doc => {
    //         
    //     })
    //     return false;
    // });
    let docs = await getDocs(query(collection(db, path), where(field, '==', value)));
    console.log(docs.docs.length === 0);
    return !(docs.docs.length === 0);
    // if(docs.empty) return false;
    // docs.forEach(doc => {
    //     console.log(doc.get(field))
    //     if(doc.get(field) === value) return true;
    // })
    // return false;
}

function slugify(string) {
    return string.split(" ").join("-")
}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDate(value) {
    if (!value) return '';
    if (typeof value === 'object' && typeof value.toDate === 'function') value = value.toDate();
    if (typeof value === 'string' || typeof value === 'number') value = new Date(value);
    if (!(value instanceof Date) || isNaN(value)) return '';
    return value.toLocaleString();
}


export { checkIfExists, slugify, capitalize, formatDate }