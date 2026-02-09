/**
 * Script to create test users for all roles
 * Run this to create sample accounts for testing
 * 
 * Usage: node scripts/create-test-users.js
 */

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { query } = require('../config/database')

const testUsers = [
  {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@company.com',
    password: 'Password123!',
    role: 'user'
  },
  {
    name: 'Mike Chen',
    email: 'mike.chen@company.com',
    password: 'Password123!',
    role: 'it_support'
  },
  {
    name: 'Alex Rodriguez',
    email: 'alex.rodriguez@company.com',
    password: 'Password123!',
    role: 'security_officer'
  },
  {
    name: 'Jennifer Smith',
    email: 'jennifer.smith@company.com',
    password: 'Password123!',
    role: 'admin'
  }
]

async function createTestUsers() {
  try {
    console.log('=== STARKSON Test Users Creator ===\n')

    for (const user of testUsers) {
      // Check if user exists
      const existing = await query('users', 'select', {
        filters: [{ column: 'email', value: user.email }],
        single: true
      })

      if (existing) {
        console.log(`⏭️  User ${user.email} already exists, skipping...`)
        continue
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 10)

      // Create user
      const result = await query('users', 'insert', {
        data: {
          email: user.email,
          password: hashedPassword,
          name: user.name,
          role: user.role,
          status: 'active'
        }
      })

      console.log(`✅ Created ${user.role}: ${user.name} (${user.email})`)
    }

    console.log('\n✅ All test users created successfully!')
    console.log('\nTest Accounts:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    testUsers.forEach(user => {
      console.log(`\n${user.role.toUpperCase()}`)
      console.log(`  Email: ${user.email}`)
      console.log(`  Password: ${user.password}`)
      console.log(`  Name: ${user.name}`)
    })
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\nYou can now login with any of these accounts.')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error creating test users:', error.message)
    process.exit(1)
  }
}

createTestUsers()
