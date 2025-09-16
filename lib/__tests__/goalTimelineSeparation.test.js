const { test } = require('node:test');
const assert = require('node:assert/strict');

// Mock Supabase client for testing
function createMockSupabase(mockData) {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'test-user-id' } } })
    },
    from: (table) => ({
      select: () => ({
        eq: (column, value) => ({
          eq: (column2, value2) => ({
            order: () => Promise.resolve({ 
              data: mockData[table] || [], 
              error: null 
            })
          })
        })
      })
    })
  };
}

test('Global timeline fetches only 12-week goals', async () => {
  const mockData = {
    '0008-ap-goals-12wk': [
      { id: 'goal1', title: 'Goal 1', status: 'active', goal_type: '12week' },
      { id: 'goal2', title: 'Goal 2', status: 'active', goal_type: '12week' },
      { id: 'goal3', title: 'Goal 3', status: 'active', goal_type: '12week' },
      { id: 'goal4', title: 'Goal 4', status: 'active', goal_type: '12week' },
      { id: 'goal5', title: 'Goal 5', status: 'active', goal_type: '12week' }
    ],
    '0008-ap-goals-custom': [
      { id: 'custom1', title: 'Custom Goal 1', status: 'active', goal_type: 'custom' },
      { id: 'custom2', title: 'Custom Goal 2', status: 'active', goal_type: 'custom' }
    ]
  };

  const supabase = createMockSupabase(mockData);
  
  // Simulate fetching goals for a global timeline
  const { data: twelveWeekGoals } = await supabase
    .from('0008-ap-goals-12wk')
    .select('*')
    .eq('user_id', 'test-user-id')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  // Should return exactly 5 goals from 12-week table
  assert.equal(twelveWeekGoals.length, 5);
  assert.ok(twelveWeekGoals.every(goal => goal.goal_type === '12week'));
});

test('Custom timeline fetches only custom goals', async () => {
  const mockData = {
    '0008-ap-goals-12wk': [
      { id: 'goal1', title: 'Goal 1', status: 'active', goal_type: '12week' },
      { id: 'goal2', title: 'Goal 2', status: 'active', goal_type: '12week' },
      { id: 'goal3', title: 'Goal 3', status: 'active', goal_type: '12week' },
      { id: 'goal4', title: 'Goal 4', status: 'active', goal_type: '12week' },
      { id: 'goal5', title: 'Goal 5', status: 'active', goal_type: '12week' }
    ],
    '0008-ap-goals-custom': [
      { id: 'custom1', title: 'Custom Goal 1', status: 'active', goal_type: 'custom' },
      { id: 'custom2', title: 'Custom Goal 2', status: 'active', goal_type: 'custom' }
    ]
  };

  const supabase = createMockSupabase(mockData);
  
  // Simulate fetching goals for a custom timeline
  const { data: customGoals } = await supabase
    .from('0008-ap-goals-custom')
    .select('*')
    .eq('user_id', 'test-user-id')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  // Should return exactly 2 goals from custom table
  assert.equal(customGoals.length, 2);
  assert.ok(customGoals.every(goal => goal.goal_type === 'custom'));
});

test('Inactive goals are excluded from both timeline types', async () => {
  const mockData = {
    '0008-ap-goals-12wk': [
      { id: 'goal1', title: 'Active Goal', status: 'active', goal_type: '12week' },
      { id: 'goal2', title: 'Inactive Goal', status: 'completed', goal_type: '12week' },
      { id: 'goal3', title: 'Cancelled Goal', status: 'cancelled', goal_type: '12week' }
    ],
    '0008-ap-goals-custom': [
      { id: 'custom1', title: 'Active Custom', status: 'active', goal_type: 'custom' },
      { id: 'custom2', title: 'Paused Custom', status: 'paused', goal_type: 'custom' }
    ]
  };

  const supabase = createMockSupabase(mockData);
  
  // Test 12-week goals filtering
  const { data: activeGoals } = await supabase
    .from('0008-ap-goals-12wk')
    .select('*')
    .eq('user_id', 'test-user-id')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  // Should return only 1 active goal
  assert.equal(activeGoals.length, 1);
  assert.equal(activeGoals[0].status, 'active');

  // Test custom goals filtering
  const { data: activeCustomGoals } = await supabase
    .from('0008-ap-goals-custom')
    .select('*')
    .eq('user_id', 'test-user-id')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  // Should return only 1 active custom goal
  assert.equal(activeCustomGoals.length, 1);
  assert.equal(activeCustomGoals[0].status, 'active');
});