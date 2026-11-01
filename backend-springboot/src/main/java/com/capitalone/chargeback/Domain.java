package com.capitalone.chargeback;

import jakarta.persistence.*;import java.math.*;import java.time.*;import java.util.*;import org.springframework.data.jpa.repository.*;
@Entity class CardTransaction { @Id String id; String customerId,merchant; BigDecimal amount; LocalDate date; String status="POSTED"; boolean disputed; CardTransaction(){} CardTransaction(String i,String m,String a){id=i;customerId="customer-001";merchant=m;amount=new BigDecimal(a);date=LocalDate.now().minusDays(2);} }
@Entity class DisputeCase { @Id @GeneratedValue(strategy=GenerationType.UUID) String id; String customerId; Instant createdAt=Instant.now(); String status="SUBMITTED",workflowInstanceId; @OneToMany(cascade=CascadeType.ALL) List<DisputeItem> items=new ArrayList<>(); }
@Entity class DisputeItem { @Id @GeneratedValue(strategy=GenerationType.UUID) String id; String transactionId,reason; String merchant; BigDecimal amount; String status="PENDING",decision="PENDING",refundStatus="NOT_STARTED"; String merchantResponse; }
interface TransactionRepository extends JpaRepository<CardTransaction,String>{}
interface DisputeRepository extends JpaRepository<DisputeCase,String>{}
record DisputeLine(String transactionId,String reason){} record CreateDisputeRequest(String customerId,List<DisputeLine> items){}
record DashboardSummary(long openDisputes,long approved,long rejected,long alerts){}
