import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const RepaymentsPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const fetchRepayments = async () => {
        const response = await fetch(`/api/loans/${id}/repayments`);
        const data = await response.json();
        setRepayments(data);
        setLoading(false);
      };

      fetchRepayments();
    }
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Repayment History</h1>
      <table className="min-w-full bg-white border border-gray-300">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b">Date</th>
            <th className="py-2 px-4 border-b">Amount</th>
            <th className="py-2 px-4 border-b">Status</th>
          </tr>
        </thead>
        <tbody>
          {repayments.map((repayment) => (
            <tr key={repayment.id}>
              <td className="py-2 px-4 border-b">{new Date(repayment.paidDate).toLocaleDateString()}</td>
              <td className="py-2 px-4 border-b">{repayment.amount}</td>
              <td className="py-2 px-4 border-b">{repayment.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RepaymentsPage;