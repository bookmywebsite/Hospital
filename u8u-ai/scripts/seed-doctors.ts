import { prisma } from '../src/lib/prisma';

async function seedDoctors() {
  try {
    console.log('🌱 Starting doctor seeding...');

    // Get organization (assuming first one exists)
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.error('❌ No organization found. Please create an organization first.');
      return;
    }

    console.log(`✅ Found organization: ${org.id}`);

    // Create default departments if they don't exist
    const departmentNames = ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'General Medicine', 'Dermatology'];
    
    for (const deptName of departmentNames) {
      const existingDept = await prisma.department.findFirst({
        where: { name: deptName, organizationId: org.id },
      });

      if (!existingDept) {
        await prisma.department.create({
          data: {
            organizationId: org.id,
            name: deptName,
            code: deptName.substring(0, 3).toUpperCase(),
          },
        });
        console.log(`✅ Created department: ${deptName}`);
      } else {
        console.log(`⏭️  Department already exists: ${deptName}`);
      }
    }

    // Get departments for doctor assignment
    const departments = await prisma.department.findMany({
      where: { organizationId: org.id },
    });

    if (departments.length === 0) {
      console.error('❌ Failed to create or find departments.');
      return;
    }

    console.log(`✅ Found ${departments.length} departments`);

    // Sample doctors data
    const doctorsData = [
      {
        name: 'Dr. Rajesh Kumar',
        specialization: 'Cardiology',
        departmentName: 'Cardiology',
        availability: {
          Monday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
          Tuesday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
          Wednesday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
          Thursday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
          Friday: ['09:00', '10:00', '11:00', '14:00', '15:00'],
          Saturday: ['09:00', '10:00', '11:00'],
        },
      },
      {
        name: 'Dr. Priya Sharma',
        specialization: 'Neurology',
        departmentName: 'Neurology',
        availability: {
          Monday: ['10:00', '11:00', '13:00', '14:00', '15:00'],
          Wednesday: ['10:00', '11:00', '13:00', '14:00', '15:00'],
          Friday: ['10:00', '11:00', '13:00', '14:00', '15:00'],
          Saturday: ['09:00', '10:00', '11:00', '12:00'],
        },
      },
      {
        name: 'Dr. Arjun Singh',
        specialization: 'Orthopedics',
        departmentName: 'Orthopedics',
        availability: {
          Monday: ['08:00', '09:00', '10:00', '15:00', '16:00', '17:00'],
          Tuesday: ['08:00', '09:00', '10:00', '15:00', '16:00', '17:00'],
          Wednesday: ['08:00', '09:00', '10:00', '15:00', '16:00', '17:00'],
          Thursday: ['08:00', '09:00', '10:00', '15:00', '16:00', '17:00'],
          Friday: ['08:00', '09:00', '10:00', '14:00', '15:00'],
        },
      },
      {
        name: 'Dr. Anjali Patel',
        specialization: 'Pediatrics',
        departmentName: 'Pediatrics',
        availability: {
          Monday: ['09:00', '10:00', '11:00', '16:00', '17:00'],
          Tuesday: ['09:00', '10:00', '11:00', '16:00', '17:00'],
          Wednesday: ['09:00', '10:00', '11:00', '16:00', '17:00'],
          Thursday: ['09:00', '10:00', '11:00', '16:00', '17:00'],
          Friday: ['09:00', '10:00', '11:00', '15:00', '16:00'],
          Saturday: ['10:00', '11:00'],
        },
      },
      {
        name: 'Dr. Vikram Desai',
        specialization: 'General Medicine',
        departmentName: 'General Medicine',
        availability: {
          Monday: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
          Tuesday: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
          Wednesday: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
          Thursday: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
          Friday: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
          Saturday: ['09:00', '10:00', '11:00', '12:00'],
        },
      },
      {
        name: 'Dr. Meera Gupta',
        specialization: 'Dermatology',
        departmentName: 'Dermatology',
        availability: {
          Monday: ['11:00', '12:00', '13:00', '15:00', '16:00'],
          Wednesday: ['11:00', '12:00', '13:00', '15:00', '16:00'],
          Friday: ['11:00', '12:00', '13:00', '15:00', '16:00'],
          Saturday: ['10:00', '11:00', '12:00'],
        },
      },
    ];

    let createdCount = 0;

    for (const doctorData of doctorsData) {
      // Find the correct department
      const department = departments.find(d => d.name === doctorData.departmentName);
      
      if (!department) {
        console.warn(`⚠️  Department not found for ${doctorData.name}`);
        continue;
      }

      // Check if doctor already exists
      const existingDoctor = await prisma.doctor.findFirst({
        where: {
          name: doctorData.name,
          organizationId: org.id,
        },
      });

      if (existingDoctor) {
        console.log(`⏭️  Dr. ${doctorData.name} already exists`);
        continue;
      }

      // Create doctor
      const doctor = await prisma.doctor.create({
        data: {
          organizationId: org.id,
          departmentId: department.id,
          name: doctorData.name,
          specialization: doctorData.specialization,
          availability: doctorData.availability,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${doctor.name} (${doctor.specialization}) in ${department.name}`);
      createdCount++;
    }

    console.log(`\n🎉 Seeding complete! Created ${createdCount} doctors`);
  } catch (error) {
    console.error('❌ Error seeding doctors:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedDoctors();
