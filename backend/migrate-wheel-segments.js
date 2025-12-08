const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Migration Script: Add prizeType and amount to existing wheel segments
 * 
 * This script updates all existing wheels in the database to ensure every segment
 * has the new prizeType and amount fields with default values.
 * 
 * Run this ONCE after deploying the new code to ensure existing wheels work properly.
 */

async function migrateWheelSegments() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB');

    const Wheel = mongoose.model('Wheel', new mongoose.Schema({}, { strict: false }));

    // Find all wheels
    const wheels = await Wheel.find({});
    console.log(`\nFound ${wheels.length} wheels to check`);

    let updatedCount = 0;

    for (const wheel of wheels) {
      let needsUpdate = false;
      
      // Check if any segment is missing prizeType or amount
      const updatedSegments = wheel.segments.map(segment => {
        const updates = { ...segment.toObject() };
        
        // Add prizeType if missing
        if (!updates.prizeType) {
          updates.prizeType = 'other';
          needsUpdate = true;
        }
        
        // Add amount if missing
        if (updates.amount === undefined || updates.amount === null) {
          updates.amount = '';
          needsUpdate = true;
        }
        
        return updates;
      });

      if (needsUpdate) {
        wheel.segments = updatedSegments;
        await wheel.save();
        updatedCount++;
        console.log(`✓ Updated wheel: ${wheel.name} (${wheel.routeName})`);
      } else {
        console.log(`  Skipped wheel: ${wheel.name} (already has prize fields)`);
      }
    }

    console.log(`\n✓ Migration complete!`);
    console.log(`  - Total wheels: ${wheels.length}`);
    console.log(`  - Updated: ${updatedCount}`);
    console.log(`  - Already current: ${wheels.length - updatedCount}`);

  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run migration
migrateWheelSegments();
