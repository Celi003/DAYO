import { useEffect, useState } from "react";
import {
  getInvoices,
  getProviders,
  getBrokers,
  getCompanies,
  getInvoiceStatistics,
} from "@/services/api";
import { Invoice, Company, Broker, Partner } from "@/types";

export function useBillingData(selectedYear: number) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [stats, setStats] = useState({
    totalInvoiced: 0,
    totalPaid: 0,
    totalRejected: 0,
    outstanding: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          invoicesData,
          providersData,
          companiesData,
          brokersData,
          statsData,
        ] = await Promise.all([
          getInvoices(),
          getProviders(),
          getCompanies(),
          getBrokers(),
          getInvoiceStatistics({ year: selectedYear }),
        ]);

        setInvoices(invoicesData);
        setPartners(providersData);
        setCompanies(companiesData);
        setBrokers(brokersData);

        setStats({
          totalInvoiced: statsData.monthly_stats.reduce(
            (sum: number, stat: any) => sum + stat.total_billed,
            0
          ),
          totalPaid: statsData.monthly_stats.reduce(
            (sum: number, stat: any) => sum + stat.total_paid,
            0
          ),
          totalRejected: statsData.monthly_stats.reduce(
            (sum: number, stat: any) => sum + stat.total_rejected,
            0
          ),
          outstanding: statsData.monthly_stats.reduce(
            (sum: number, stat: any) => sum + stat.total_remaining,
            0
          ),
        });
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear]);

    const companyMap = new Map(companies.map((c: Company) => [c.id, c]));
    const brokerMap = new Map(brokers.map((b: Broker) => [b.id, b]));

  return {
    invoices,
    setInvoices,
    companies,
    brokers,
    companyMap,
    brokerMap,
    loading,
    partners,
    stats,
  };
}
