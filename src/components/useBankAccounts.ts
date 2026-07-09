import { useState, useEffect } from 'react';
import { BankAccount } from '../types.ts';
import { useAuth } from './AuthContext.tsx';

export const useBankAccounts = () => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const { fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/bank-accounts');
      if (res.ok) {
        const data = await res.json();
        setBankAccounts(data);
      }
    } catch (error) {
      console.error('Failed to load bank accounts', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const addBankAccount = async (accountData: Omit<BankAccount, 'id' | 'createdAt'>) => {
    try {
      const res = await fetchWithAuth('/api/bank-accounts', {
        method: 'POST',
        body: JSON.stringify(accountData)
      });
      if (res.ok) {
        const newAccount = await res.json();
        setBankAccounts([newAccount, ...bankAccounts]);
        return newAccount;
      }
    } catch (error) {
      console.error('Failed to add bank account', error);
      throw error;
    }
  };

  const updateBankAccount = async (id: number, accountData: Partial<BankAccount>) => {
    try {
      const res = await fetchWithAuth(`/api/bank-accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(accountData)
      });
      if (res.ok) {
        const updated = await res.json();
        setBankAccounts(bankAccounts.map(b => b.id === id ? updated : b));
        return updated;
      }
    } catch (error) {
      console.error('Failed to update bank account', error);
      throw error;
    }
  };

  const removeBankAccount = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/bank-accounts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setBankAccounts(bankAccounts.filter(acc => acc.id !== id));
      }
    } catch (error) {
      console.error('Failed to remove bank account', error);
      throw error;
    }
  };

  return { bankAccounts, loading, fetchAccounts, addBankAccount, updateBankAccount, removeBankAccount };
};
