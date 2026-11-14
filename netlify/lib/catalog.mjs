// Catálogo OFICIAL (el servidor recalcula precios con esto; nunca confía en el navegador).
const classic = ["chocolate", "naranja", "moka", "canela", "chocolate-blanco", "oreo"];
const special = ["red-velvet", "pink-velvet", "arandanos", "guayaba"];
const NAMES = {
  chocolate: "Chocolate", naranja: "Naranja", moka: "Moka", canela: "Canela",
  "chocolate-blanco": "Chocolate blanco", oreo: "Oreo", "red-velvet": "Red Velvet",
  "pink-velvet": "Pink Velvet", arandanos: "Arándanos", guayaba: "Guayaba"
};
export const PRODUCTS = {};
classic.forEach((id) => {
  PRODUCTS[id + "|u"] = { name: NAMES[id], label: "unidad", price: 7, flavor: id };
  PRODUCTS[id + "|p"] = { name: NAMES[id], label: "paquete de 10", price: 65, flavor: id };
});
special.forEach((id) => {
  PRODUCTS[id + "|u"] = { name: NAMES[id], label: "unidad", price: 9, flavor: id };
  PRODUCTS[id + "|p"] = { name: NAMES[id], label: "paquete de 10", price: 85, flavor: id };
});
PRODUCTS["caja-mix-10|c"] = { name: "Caja mix de 10", label: "caja", price: 92, flavor: "caja-mix-10" };
PRODUCTS["caja-5-especiales|c"] = { name: "Caja de 5 especiales", label: "caja", price: 55, flavor: "caja-5-especiales" };
PRODUCTS["caja-panda-3|c"] = { name: "Caja panda de 3 especiales", label: "caja", price: 70, flavor: "caja-panda-3" };

export const ZONES = {
  "La Paz": {
    Centro: 6, Sopocachi: 6, "San Pedro": 7, Miraflores: 8, "San Jorge": 8, "Villa Fátima": 10,
    Munaypata: 10, Pampahasi: 12, Obrajes: 12, "Alto Obrajes": 14, Calacoto: 15, Achumani: 18,
    Irpavi: 18, "Cota Cota": 20, Seguencoma: 20
  },
  "El Alto": {
    "Ceja de El Alto": 15, "16 de Julio": 15, "Villa Dolores": 18, "Ciudad Satélite": 18,
    "Río Seco": 20, "Villa Adela": 20, "Rosas Pampa": 22, "Santiago II": 22, Senkata: 25
  }
};
export const MAX_QTY_PER_LINE = 50;
export const MAX_LINES = 20;
