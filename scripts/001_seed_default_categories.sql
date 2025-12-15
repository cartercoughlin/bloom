-- Seed default categories for new users
-- Run this after creating the schema to populate default categories

INSERT INTO public.categories (user_id, name, color, icon) VALUES
-- Essential categories
(auth.uid(), 'Groceries', '#10B981', '🛒'),
(auth.uid(), 'Restaurants', '#F59E0B', '🍽️'),
(auth.uid(), 'Gas & Fuel', '#EF4444', '⛽'),
(auth.uid(), 'Shopping', '#8B5CF6', '🛍️'),
(auth.uid(), 'Entertainment', '#EC4899', '🎬'),
(auth.uid(), 'Bills & Utilities', '#6B7280', '💡'),
(auth.uid(), 'Healthcare', '#14B8A6', '🏥'),
(auth.uid(), 'Transportation', '#3B82F6', '🚗'),
(auth.uid(), 'Home & Garden', '#84CC16', '🏠'),
(auth.uid(), 'Personal Care', '#F97316', '💄'),
(auth.uid(), 'Education', '#6366F1', '📚'),
(auth.uid(), 'Travel', '#06B6D4', '✈️'),
(auth.uid(), 'Gifts & Donations', '#D946EF', '🎁'),
(auth.uid(), 'Subscriptions', '#64748B', '📱'),
(auth.uid(), 'Insurance', '#0EA5E9', '🛡️'),
(auth.uid(), 'Taxes', '#DC2626', '📋'),
(auth.uid(), 'Savings', '#059669', '💰'),
(auth.uid(), 'Investments', '#7C3AED', '📈'),
(auth.uid(), 'Income', '#16A34A', '💵'),
(auth.uid(), 'Other', '#9CA3AF', '📦')
ON CONFLICT DO NOTHING;
