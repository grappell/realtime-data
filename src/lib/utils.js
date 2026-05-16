import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore"

async function checkIfExists(db, path, field, value) {
    let docs = await getDocs(query(collection(db, path), where(field, '==', value)));
    return !(docs.docs.length === 0);
}

async function checkIfMany(db, path,  fieldA, valueA, fieldB, valueB) {
    let docs = await getDocs(query(collection(db, path), where(fieldA, '==', valueA), where(fieldB, "==", valueB)));
    return !(docs.docs.length === 0);
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


export { checkIfExists, checkIfMany, slugify, capitalize, formatDate }