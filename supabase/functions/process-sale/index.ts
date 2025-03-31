import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get request data
    const { result } = await req.json();

    if (!result?.data) {
      throw new Error('Invalid result data');
    }

    // Process the sale data
    const sale = result.data;
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create or update customer record
    const customer = sale.details?.customer;
    if (customer) {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .upsert({
          first_name: customer.name?.split(' ')[0] || '',
          last_name: customer.name?.split(' ').slice(1).join(' ') || '',
          email: customer.email,
          phone: customer.phone,
          street: customer.address,
          postal_code: customer.postal_code
        })
        .select()
        .single();

      if (customerError) {
        throw new Error(`Customer error: ${JSON.stringify(customerError)}`);
      }

      // Create sale record
      if (customerData) {
        const { error: saleError } = await supabase
          .from('sales')
          .insert({
            customer_id: customerData.id,
            agent_id: sale.agent_id,
            supplier_id: sale.supplier_id,
            gross_amount: sale.amount,
            agent_commission: sale.commission,
            sale_date: sale.created_at
          });

        if (saleError) {
          throw new Error(`Sale error: ${JSON.stringify(saleError)}`);
        }
      }
    }

    // Mark result as processed
    await supabase
      .from('scraper_results')
      .update({ processed: true })
      .eq('id', result.id);

    return new Response(
      JSON.stringify({ success: true }), 
      { 
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error processing sale:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }), 
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});