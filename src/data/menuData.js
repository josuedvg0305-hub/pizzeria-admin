let _nextId = 90000
export function generateId() { return ++_nextId }

function mkSimple(id, name, description, price) {
  return {
    id, name, description, active: true, images: [],
    priceType: 'simple', price, promoPrice: null, cost: null,
    variants: [], modifierGroupIds: [],
    stock: { enabled: false, quantity: 0, alertAt: 5 },
  }
}

function mkVariant(id, name, description, prices, modGroupIds = []) {
  return {
    id, name, description, active: true, images: [],
    priceType: 'variants', price: 0, promoPrice: null, cost: null,
    variants: [
      { id: id * 10 + 1, name: 'Familiar', price: prices[0], promoPrice: null },
      { id: id * 10 + 2, name: 'Mediana',  price: prices[1], promoPrice: null },
      { id: id * 10 + 3, name: 'Porción',  price: prices[2], promoPrice: null },
    ],
    modifierGroupIds: modGroupIds,
    stock: { enabled: false, quantity: 0, alertAt: 5 },
  }
}

export const initialModifierGroups = [
  {
    id: 1, name: 'Ingredientes extra',
    required: false, multiple: true, min: 0, max: null,
    options: [
      { id: 101, name: 'Queso extra',   price: 800,  promoPrice: null },
      { id: 102, name: 'Jamón',          price: 900,  promoPrice: null },
      { id: 103, name: 'Champiñones',    price: 700,  promoPrice: null },
      { id: 104, name: 'Pimentón rojo',  price: 700,  promoPrice: null },
      { id: 105, name: 'Aceitunas',      price: 600,  promoPrice: null },
    ],
  },
  {
    id: 2, name: 'Tipo de borde',
    required: false, multiple: false, min: 0, max: 1,
    options: [
      { id: 201, name: 'Borde normal',         price: 0,    promoPrice: null },
      { id: 202, name: 'Borde relleno queso',  price: 1500, promoPrice: null },
    ],
  },
]

export const initialCategories = [
  {
    id: 1, name: 'Entradas', active: true,
    products: [
      mkSimple(101, 'Palitos de Ajo',   'Bastones de pan con mantequilla de ajo al horno',   2500),
      mkSimple(102, 'Palitos de Pesto', 'Bastones de pan con salsa pesto casera',             3000),
      mkSimple(103, 'Nuggets',          'Nuggets de pollo crujientes con salsa a elegir',     2000),
      mkSimple(104, 'Tequeños',         'Palitos de queso derretido en masa crujiente',       2600),
    ],
  },
  {
    id: 2, name: 'Pizzas Clásicas', active: true,
    products: [
      mkVariant(201, 'Mía Margarita', 'Salsa de tomate, mozzarella y albahaca fresca',                       [15000, 10000, 3000], [1, 2]),
      mkVariant(202, 'Oli Pepperoni', 'Salsa de tomate, mozzarella y pepperoni importado',                   [15000, 10000, 3000], [1, 2]),
      mkVariant(203, 'BBQ',           'Salsa BBQ, pollo ahumado, cebolla morada y mozzarella',               [15000, 10000, 3000], [1, 2]),
      mkVariant(204, 'Vegetariana',   'Pimentón, champiñones, aceituna, cebolla y mozzarella',               [15000, 10000, 3000], [1, 2]),
      mkVariant(205, 'Pesto',         'Salsa pesto casera, tomate cherry y mozzarella',                      [15000, 10000, 3000], [1, 2]),
      mkVariant(206, 'Napolitana',    'Salsa de tomate, mozzarella, tomate fresco y orégano',                [15000, 10000, 3000], [1, 2]),
    ],
  },
  {
    id: 3, name: 'Pizzas Especiales', active: true,
    products: [
      mkVariant(301, '3 Carnes',        'Chorizo, vacuno y pollo con salsa de la casa',                       [17000, 11000, 3500], [1, 2]),
      mkVariant(302, 'Mechada',          'Carne mechada, cebolla caramelizada y mozzarella',                  [17000, 11000, 3500], [1, 2]),
      mkVariant(303, 'La Española',      'Jamón serrano, rúcula, tomate deshidratado y mozzarella',           [17000, 11000, 3500], [1, 2]),
      mkVariant(304, 'Peppe Campestre',  'Pepperoni, champiñones, pimentón y salsa rosada',                   [17000, 11000, 3500], [1, 2]),
      mkVariant(305, 'Hawaiana',         'Jamón, piña caramelizada, mozzarella y salsa teriyaki',             [17000, 11000, 3500], [1, 2]),
      mkVariant(306, '3 Quesos',         'Mozzarella, queso azul y parmesano con miel de abeja',              [17000, 11000, 3500], [1, 2]),
    ],
  },
  {
    id: 4, name: 'Bebidas', active: true,
    products: [
      mkSimple(401, 'Bebida Lata',    'Coca-Cola, Sprite, Fanta o Schop (lata 350 ml)',        1500),
      mkSimple(402, 'Bebida 1.5 lts', 'Bebida familiar 1.5 litros a elección',                 3000),
      mkSimple(403, 'Té',             'Té caliente o helado, sabores variados',                 1500),
      mkSimple(404, 'Jugo Natural',   'Jugo de naranja, mango o frambuesa recién hecho',        3500),
    ],
  },
  {
    id: 5, name: 'Promos', active: true,
    products: [
      mkSimple(501, 'Combo Individual',      '1 Porción pizza + bebida lata',                          6000),
      mkSimple(502, 'Combo Mediano',          '1 Pizza mediana + bebida 1.5 lts',                      13000),
      mkSimple(503, 'Combo para Compartir',  '1 Pizza familiar + 2 bebidas + entrada a elección',      18000),
    ],
  },
]
