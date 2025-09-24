import { useEffect, useState } from "react";
import {
  getInvoices,
  getProviders,
  getCompanys,
  getCompanies,
  getInvoiceStatistics,
} from "@/services/api";
import { Invoice, Broker, Company, Partner, Provider } from "@/types";

export function useBillingData(selectedYear: number) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Broker[]>([]);
  const [Companys, setCompanys] = useState<Company[]>([]);
  const [partners, setPartners] = useState<Provider[]>([]);
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
          CompanysData,
          statsData,
        ] = await Promise.all([
          getInvoices(),
          getProviders(),
          getCompanies(),
          getCompanys(),
          getInvoiceStatistics({ year: selectedYear }),
        ]);

        setInvoices(invoicesData);
        setPartners(providersData);
        setCompanies(companiesData);
        setCompanys(CompanysData);

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

    const BrokerMap = new Map(companies.map((c: Broker) => [c.id, c]));
    const CompanyMap = new Map(Companys.map((b: Company) => [b.id, b]));

  return {
    invoices,
    setInvoices,
    companies,
    Companys,
    BrokerMap,
    CompanyMap,
    loading,
    partners,
    stats,
  };
}
