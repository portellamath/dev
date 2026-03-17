import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Iniciando seed...")

  // ========================
  // CATEGORIAS
  // ========================

  const teclados = await prisma.category.upsert({
    where: { slug: "teclados" },
    update: {},
    create: {
      name: "Teclados",
      slug: "teclados"
    }
  })

  const mecanicos = await prisma.category.upsert({
    where: { slug: "teclados-mecanicos" },
    update: {},
    create: {
      name: "Teclados Mecânicos",
      slug: "teclados-mecanicos",
      parentId: teclados.id
    }
  })

  const rgb = await prisma.category.upsert({
    where: { slug: "rgb" },
    update: {},
    create: {
      name: "RGB",
      slug: "rgb",
      parentId: teclados.id
    }
  })

  // ========================
  // PRODUTOS
  // ========================

  const products = [
    {
      name: "Teclado Mecânico RGB Red Switch",
      slug: "teclado-mecanico-red",
      price: 299.90,
      stock: 15,
      specs: {
        switch: "Red",
        layout: "ABNT2",
        rgb: true,
        size: "Full Size"
      }
    },
    {
      name: "Teclado Mecânico Blue Switch",
      slug: "teclado-mecanico-blue",
      price: 259.90,
      stock: 10,
      specs: {
        switch: "Blue",
        layout: "ABNT2",
        rgb: false,
        size: "TKL"
      }
    },
    {
      name: "Teclado Gamer 60% RGB",
      slug: "teclado-60-rgb",
      price: 199.90,
      stock: 20,
      specs: {
        switch: "Red",
        layout: "60%",
        rgb: true,
        size: "60%"
      }
    },
    {
      name: "Teclado Mecânico Wireless",
      slug: "teclado-wireless",
      price: 349.90,
      stock: 8,
      specs: {
        switch: "Brown",
        layout: "ABNT2",
        rgb: true,
        wireless: true
      }
    },
    {
      name: "Teclado Básico Membrana",
      slug: "teclado-membrana",
      price: 89.90,
      stock: 30,
      specs: {
        type: "membrana",
        layout: "ABNT2",
        rgb: false
      }
    }
  ]

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        price: product.price,
        stock: product.stock
      },
      create: {
        name: product.name,
        slug: product.slug,
        price: product.price,
        stock: product.stock,

        images: [
          "https://via.placeholder.com/300",
          "https://via.placeholder.com/300"
        ],

        specs: product.specs,

        categories: {
          connect: [
            { id: teclados.id },
            { id: mecanicos.id }
          ]
        }
      }
    })
  }

  console.log("✅ Seed finalizado!")
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })