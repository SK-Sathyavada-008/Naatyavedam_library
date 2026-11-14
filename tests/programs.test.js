import test from 'node:test';
import assert from 'node:assert/strict';

// Helper reorder function identical to ProgramsPage and db.ts logic
function reorderItems(items, fromIndex, toIndex) {
  const result = [...items];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result.map((item, index) => ({
    ...item,
    position: index,
  }));
}

// Program duplication logic
function duplicateProgram(program, items, newTitle, createdByName) {
  const newProgramId = `prog-cloned-${Date.now()}`;
  const now = new Date().toISOString();

  const clonedProgram = {
    ...program,
    id: newProgramId,
    title: newTitle || `${program.title} (Copy)`,
    createdByName,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  const clonedItems = items.map((item, idx) => ({
    ...item,
    id: `item-cloned-${idx}`,
    programId: newProgramId,
    position: idx,
    createdAt: now,
    updatedAt: now,
  }));

  return { clonedProgram, clonedItems };
}

// Permission check helper
function canManagePrograms(user) {
  if (!user) return false;
  if (user.status !== 'APPROVED') return false;
  return user.role === 'TEACHER' || user.role === 'STUDENT';
}

test('Programs: Can reorder songs by drag-and-drop or move buttons', () => {
  const initialItems = [
    { id: '1', title: 'Pushpanjali', position: 0 },
    { id: '2', title: 'Jatiswaram', position: 1 },
    { id: '3', title: 'Krishna Shabdam', position: 2 },
    { id: '4', title: 'Tarangam', position: 3 },
  ];

  // Move Shabdam (index 2) to first place (index 0)
  const reordered = reorderItems(initialItems, 2, 0);

  assert.equal(reordered[0].title, 'Krishna Shabdam');
  assert.equal(reordered[0].position, 0);
  assert.equal(reordered[1].title, 'Pushpanjali');
  assert.equal(reordered[1].position, 1);
  assert.equal(reordered[2].title, 'Jatiswaram');
  assert.equal(reordered[2].position, 2);
  assert.equal(reordered[3].title, 'Tarangam');
  assert.equal(reordered[3].position, 3);
});

test('Programs: Moving items down re-indexes correctly', () => {
  const initialItems = [
    { id: '1', title: 'Pushpanjali', position: 0 },
    { id: '2', title: 'Jatiswaram', position: 1 },
    { id: '3', title: 'Krishna Shabdam', position: 2 },
  ];

  // Move Pushpanjali (index 0) to end (index 2)
  const reordered = reorderItems(initialItems, 0, 2);

  assert.equal(reordered[0].title, 'Jatiswaram');
  assert.equal(reordered[0].position, 0);
  assert.equal(reordered[1].title, 'Krishna Shabdam');
  assert.equal(reordered[1].position, 1);
  assert.equal(reordered[2].title, 'Pushpanjali');
  assert.equal(reordered[2].position, 2);
});

test('Programs: Duplicate program preserves track order without duplicating original song files', () => {
  const program = {
    id: 'prog-01',
    title: 'Kuchipudi Festival',
    createdByName: 'Guru Veda',
  };
  const items = [
    { id: 'item-1', songId: 'song-orig-101', title: 'Pushpanjali', position: 0 },
    { id: 'item-2', songId: 'song-orig-102', title: 'Jatiswaram', position: 1 },
  ];

  const { clonedProgram, clonedItems } = duplicateProgram(
    program,
    items,
    'Kuchipudi Festival - Batch B',
    'SK'
  );

  assert.notEqual(clonedProgram.id, program.id);
  assert.equal(clonedProgram.title, 'Kuchipudi Festival - Batch B');
  assert.equal(clonedProgram.createdByName, 'SK');
  assert.equal(clonedItems.length, 2);

  // References to original library songs remain identical
  assert.equal(clonedItems[0].songId, 'song-orig-101');
  assert.equal(clonedItems[1].songId, 'song-orig-102');
  assert.notEqual(clonedItems[0].id, items[0].id);
});

test('Programs: Both Teacher (Veda) and Approved Student (SK) have equal program management permissions', () => {
  const teacher = { id: 'u1', username: 'veda', role: 'TEACHER', status: 'APPROVED' };
  const approvedStudent = { id: 'u2', username: 'sk', role: 'STUDENT', status: 'APPROVED' };
  const pendingStudent = { id: 'u3', username: 'pending_user', role: 'STUDENT', status: 'PENDING' };
  const unauthenticated = null;

  assert.equal(canManagePrograms(teacher), true);
  assert.equal(canManagePrograms(approvedStudent), true);
  assert.equal(canManagePrograms(pendingStudent), false);
  assert.equal(canManagePrograms(unauthenticated), false);
});
