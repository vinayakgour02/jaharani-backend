const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    const email = process.argv[2] || 'admin@jharanai.com'
    const password = process.argv[3] || 'admin123'
    const name = process.argv[4] || 'Admin User'

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email }
    })

    if (existingAdmin) {
      console.log('Admin with this email already exists!')
      return
    }

    // Hash password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    })

    console.log('✅ Admin created successfully!')
    console.log(`Email: ${admin.email}`)
    console.log(`Name: ${admin.name}`)
    console.log(`ID: ${admin.id}`)
    console.log('\nYou can now login with these credentials.')
    
  } catch (error) {
    console.error('❌ Error creating admin:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin() 