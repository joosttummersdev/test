import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabaseClient';

export const post: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { email, password, firstName, lastName, role, suppliers } = data;

    // Create user with admin client and set role in user_metadata
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        first_name: firstName,
        last_name: lastName
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

    // Check if profile already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    // Create or update profile
    const profileData = {
      id: user.id,
      role: role,
      first_name: firstName,
      last_name: lastName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: profileError } = existingProfile
      ? await supabaseAdmin
          .from('profiles')
          .update(profileData)
          .eq('id', user.id)
      : await supabaseAdmin
          .from('profiles')
          .insert(profileData);

    if (profileError) {
      // Cleanup: delete the auth user if profile operation fails
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      console.error('Error with profile:', profileError);
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

export const put: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { id, firstName, lastName, role, suppliers } = data;

    // Update profile with explicit role
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        role: role,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return new Response(
        JSON.stringify({ error: profileError.message }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Update supplier assignments
    const { error: deleteError } = await supabaseAdmin
      .from('user_suppliers')
      .delete()
      .eq('user_id', id);

    if (deleteError) {
      console.error('Error deleting supplier assignments:', deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (suppliers?.length > 0) {
      const { error: supplierError } = await supabaseAdmin
        .from('user_suppliers')
        .insert(
          suppliers.map((supplierId: string) => ({
            user_id: id,
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
      JSON.stringify({ success: true }), 
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

export const del: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { id } = data;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      console.error('Error deleting user:', error);
      return new Response(
        JSON.stringify({ error: error.message }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }), 
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