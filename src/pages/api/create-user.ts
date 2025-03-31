import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabaseClient';

// Validation function for required fields
function validateUserData(data: any) {
  const { email, password, firstName, lastName, role } = data;
  
  const errors = [];
  
  if (!email?.trim()) errors.push('Email is required');
  if (!password?.trim()) errors.push('Password is required');
  if (!firstName?.trim()) errors.push('First name is required');
  if (!lastName?.trim()) errors.push('Last name is required');
  if (!role?.trim()) errors.push('Role is required');
  if (!['admin', 'agent'].includes(role)) errors.push('Invalid role');
  
  return errors;
}

export const post: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    
    // Validate required fields
    const validationErrors = validateUserData(data);
    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: validationErrors.join(', ') }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { email, password, firstName, lastName, role, suppliers } = data;

    // Create user with admin client
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true,
      user_metadata: {
        role: role.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim()
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create profile with all required fields
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user.id,
        email: email.trim(),
        role: role.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      // Cleanup: delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      console.error('Error creating profile:', profileError);
      return new Response(
        JSON.stringify({ error: profileError.message }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Add supplier assignments if any
    if (suppliers?.length > 0) {
      const { error: supplierError } = await supabaseAdmin
        .from('user_suppliers')
        .insert(
          suppliers.map((supplierId: string) => ({
            user_id: user.id,
            supplier_id: supplierId
          }))
        );

      if (supplierError) {
        console.error('Error assigning suppliers:', supplierError);
        return new Response(
          JSON.stringify({ error: supplierError.message }), 
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, user }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};